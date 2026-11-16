import * as path from 'node:path';
import { ArnFormat, CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2Targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const INFRA_ROOT = path.join(__dirname, '..', '..');

export interface AppStackProps extends StackProps {
  readonly vpc: ec2.IVpc;
  readonly key: kms.IKey;
  readonly database: rds.DatabaseInstance;
  readonly databaseName: string;
  readonly djangoSecret: secretsmanager.ISecret;
  /** Bedrock model or inference profile ID used by the assistant. */
  readonly bedrockModelId: string;
  /** ACM certificate ARN. When set, the ALB serves HTTPS and redirects HTTP. */
  readonly certificateArn?: string;
  /** Email for alarm and budget notifications. */
  readonly alertEmail?: string;
  readonly monthlyBudgetUsd: number;
  readonly useFargateSpot: boolean;
}

/**
 * Django API + React frontend on ECS Fargate behind an ALB, a Bedrock-backed
 * assistant Lambda, a daily backup-check Lambda, alarms and a cost budget.
 */
export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const { vpc, database } = props;

    // Import the key and secrets by ARN so that grants go on this stack's IAM
    // roles instead of editing the key policy in the data stack (which would
    // create a circular dependency between the stacks).
    const key = kms.Key.fromKeyArn(this, 'AppKey', props.key.keyArn);
    const dbSecret = secretsmanager.Secret.fromSecretAttributes(this, 'DbSecret', {
      secretCompleteArn: database.secret!.secretArn,
      encryptionKey: key,
    });
    const djangoSecret = secretsmanager.Secret.fromSecretAttributes(this, 'DjangoSecret', {
      secretCompleteArn: props.djangoSecret.secretArn,
      encryptionKey: key,
    });

    // ---------------------------------------------------------------- alerts
    const alerts = new sns.Topic(this, 'Alerts', { masterKey: key, enforceSSL: true });
    if (props.alertEmail) {
      alerts.addSubscription(new snsSubscriptions.EmailSubscription(props.alertEmail));
    }
    const alarmAction = new cwActions.SnsAction(alerts);

    // Imported keys don't receive grants automatically: allow decrypting the
    // secrets, but only through Secrets Manager.
    const decryptSecretsStatement = new iam.PolicyStatement({
      actions: ['kms:Decrypt'],
      resources: [props.key.keyArn],
      conditions: { StringEquals: { 'kms:ViaService': `secretsmanager.${this.region}.amazonaws.com` } },
    });

    // --------------------------------------------------------------- cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      enableFargateCapacityProviders: true,
      containerInsightsV2: ecs.ContainerInsights.DISABLED,
    });
    const capacityProviderStrategies: ecs.CapacityProviderStrategy[] = props.useFargateSpot
      ? [{ capacityProvider: 'FARGATE_SPOT', weight: 1 }]
      : [{ capacityProvider: 'FARGATE', weight: 1 }];

    // ------------------------------------------------------------------- ALB
    const accessLogs = new s3.Bucket(this, 'AlbAccessLogs', {
      encryption: s3.BucketEncryption.S3_MANAGED, // ALB access logs only support SSE-S3
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [{ expiration: Duration.days(30) }],
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc,
      description: 'Public ALB',
      allowAllOutbound: false,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP from the internet');
    if (props.certificateArn) {
      albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS from the internet');
    }

    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      dropInvalidHeaderFields: true,
    });
    alb.logAccessLogs(accessLogs);

    let listener: elbv2.ApplicationListener;
    if (props.certificateArn) {
      listener = alb.addListener('Https', {
        port: 443,
        certificates: [elbv2.ListenerCertificate.fromArn(props.certificateArn)],
        sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
        open: false,
        defaultAction: elbv2.ListenerAction.fixedResponse(404),
      });
      alb.addRedirect({ sourcePort: 80, targetPort: 443, open: false });
    } else {
      listener = alb.addListener('Http', {
        port: 80,
        open: false,
        defaultAction: elbv2.ListenerAction.fixedResponse(404),
      });
    }

    // ------------------------------------------------------- shared task bits
    const taskSecurityGroup = (name: string) => {
      const sg = new ec2.SecurityGroup(this, `${name}Sg`, {
        vpc,
        description: `${name} Fargate tasks: inbound from the ALB only`,
        allowAllOutbound: true, // image pulls, Secrets Manager, CloudWatch Logs (no NAT)
      });
      return sg;
    };

    const logGroup = (name: string) =>
      new logs.LogGroup(this, `${name}Logs`, {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      });

    // --------------------------------------------------------------- backend
    const backendTask = new ecs.FargateTaskDefinition(this, 'BackendTask', {
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });
    backendTask.addContainer('backend', {
      image: ecs.ContainerImage.fromAsset(path.join(REPO_ROOT, 'Backend', 'odc'), {
        file: 'dockerfile',
        platform: ecrAssets.Platform.LINUX_AMD64,
      }),
      portMappings: [{ containerPort: 8000 }],
      environment: {
        DJANGO_SETTINGS_MODULE: 'odc.settings',
        DEBUG: 'False',
        // ALB health checks use the task IP as Host header.
        ALLOWED_HOSTS: '*',
        CORS_ALLOW_ALL_ORIGINS: 'False',
        DB_HOST: database.dbInstanceEndpointAddress,
        DB_PORT: database.dbInstanceEndpointPort,
        POSTGRES_DB: props.databaseName,
      },
      secrets: {
        POSTGRES_USER: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
        POSTGRES_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
        DJANGO_SECRET_KEY: ecs.Secret.fromSecretsManager(djangoSecret),
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'backend', logGroup: logGroup('Backend') }),
    });

    backendTask.addToExecutionRolePolicy(decryptSecretsStatement);

    const backendSg = taskSecurityGroup('Backend');
    const backend = new ecs.FargateService(this, 'BackendService', {
      cluster,
      taskDefinition: backendTask,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [backendSg],
      capacityProviderStrategies,
      circuitBreaker: { enable: true, rollback: true },
      healthCheckGracePeriod: Duration.seconds(180), // entrypoint runs migrations first
      enableExecuteCommand: false,
    });
    backend.connections.allowToDefaultPort(database, 'Backend to PostgreSQL');

    // -------------------------------------------------------------- frontend
    const frontendTask = new ecs.FargateTaskDefinition(this, 'FrontendTask', {
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });
    frontendTask.addContainer('frontend', {
      image: ecs.ContainerImage.fromAsset(path.join(REPO_ROOT, 'Frontend'), {
        file: 'dockerfile',
        platform: ecrAssets.Platform.LINUX_AMD64,
      }),
      portMappings: [{ containerPort: 80 }],
      environment: { REACT_APP_API_URL: '/api', REACT_APP_ENV: 'production', REACT_APP_DEBUG: 'false' },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'frontend', logGroup: logGroup('Frontend') }),
    });

    const frontendSg = taskSecurityGroup('Frontend');
    const frontend = new ecs.FargateService(this, 'FrontendService', {
      cluster,
      taskDefinition: frontendTask,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [frontendSg],
      capacityProviderStrategies,
      circuitBreaker: { enable: true, rollback: true },
    });

    // ------------------------------------------------------ assistant Lambda
    const assistant = new nodejs.NodejsFunction(this, 'AssistantFn', {
      entry: path.join(INFRA_ROOT, 'lambda', 'assistant', 'index.ts'),
      projectRoot: INFRA_ROOT,
      depsLockFilePath: path.join(INFRA_ROOT, 'package-lock.json'),
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(30),
      environment: { MODEL_ID: props.bedrockModelId, DJANGO_SECRET_ARN: djangoSecret.secretArn },
      logGroup: logGroup('Assistant'),
      bundling: { minify: true, sourceMap: false },
    });
    djangoSecret.grantRead(assistant);
    assistant.addToRolePolicy(decryptSecretsStatement);
    assistant.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: bedrockResourceArns(this, props.bedrockModelId),
      }),
    );

    // ------------------------------------------------------- listener rules
    listener.addTargets('Assistant', {
      priority: 10,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/assistant', '/api/assistant/'])],
      targets: [new elbv2Targets.LambdaTarget(assistant)],
    });
    const backendTg = listener.addTargets('Backend', {
      priority: 20,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/*', '/admin', '/admin/*', '/static/*'])],
      port: 8000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [backend],
      deregistrationDelay: Duration.seconds(30),
      healthCheck: { path: '/admin/login/', healthyHttpCodes: '200', interval: Duration.seconds(30) },
    });
    const frontendTg = listener.addTargets('Frontend', {
      priority: 100,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/*'])],
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [frontend],
      deregistrationDelay: Duration.seconds(30),
      healthCheck: { path: '/', healthyHttpCodes: '200' },
    });
    backendSg.addIngressRule(albSg, ec2.Port.tcp(8000), 'ALB to backend');
    frontendSg.addIngressRule(albSg, ec2.Port.tcp(80), 'ALB to frontend');

    // ---------------------------------------------------- backup-check Lambda
    const backupCheck = new nodejs.NodejsFunction(this, 'BackupCheckFn', {
      entry: path.join(INFRA_ROOT, 'lambda', 'backup-check', 'index.ts'),
      projectRoot: INFRA_ROOT,
      depsLockFilePath: path.join(INFRA_ROOT, 'package-lock.json'),
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 128,
      timeout: Duration.seconds(30),
      environment: {
        DB_INSTANCE_ID: database.instanceIdentifier,
        TOPIC_ARN: alerts.topicArn,
        MAX_AGE_HOURS: '26',
      },
      logGroup: logGroup('BackupCheck'),
      bundling: { minify: true, sourceMap: false },
    });
    alerts.grantPublish(backupCheck);
    backupCheck.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['rds:DescribeDBInstances', 'rds:DescribeDBSnapshots'],
        resources: [
          database.instanceArn,
          this.formatArn({ service: 'rds', resource: 'snapshot', resourceName: '*', arnFormat: ArnFormat.COLON_RESOURCE_NAME }),
        ],
      }),
    );
    new events.Rule(this, 'DailyBackupCheck', {
      schedule: events.Schedule.cron({ minute: '0', hour: '6' }),
      targets: [new eventsTargets.LambdaFunction(backupCheck)],
    });

    // ---------------------------------------------------------------- alarms
    const alarm = (id: string, metric: cloudwatch.IMetric, threshold: number, periods: number, op: cloudwatch.ComparisonOperator, description: string) => {
      const a = new cloudwatch.Alarm(this, id, {
        metric,
        threshold,
        evaluationPeriods: periods,
        comparisonOperator: op,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: description,
      });
      a.addAlarmAction(alarmAction);
      return a;
    };
    const GTE = cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD;

    alarm('Alb5xx', alb.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, { period: Duration.minutes(5) }), 5, 1, GTE, 'Targets returned 5+ HTTP 5xx in 5 minutes');
    alarm('BackendUnhealthy', backendTg.metrics.unhealthyHostCount({ period: Duration.minutes(1) }), 1, 3, GTE, 'Backend target unhealthy for 3 minutes');
    alarm('FrontendUnhealthy', frontendTg.metrics.unhealthyHostCount({ period: Duration.minutes(1) }), 1, 3, GTE, 'Frontend target unhealthy for 3 minutes');
    alarm('DbCpuHigh', database.metricCPUUtilization({ period: Duration.minutes(5) }), 80, 3, GTE, 'RDS CPU >= 80% for 15 minutes');
    alarm('DbStorageLow', database.metricFreeStorageSpace({ period: Duration.minutes(5) }), 2 * 1024 ** 3, 1, cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD, 'RDS free storage below 2 GiB');
    alarm('AssistantErrors', assistant.metricErrors({ period: Duration.minutes(5) }), 3, 1, GTE, 'Assistant Lambda errors');
    alarm('BackupCheckErrors', backupCheck.metricErrors({ period: Duration.hours(24) }), 1, 1, GTE, 'Backup-check Lambda failed');

    // ---------------------------------------------------------------- budget
    if (props.alertEmail) {
      const subscribers = [{ subscriptionType: 'EMAIL', address: props.alertEmail }];
      new budgets.CfnBudget(this, 'MonthlyBudget', {
        budget: {
          budgetName: 'devops-red-line-monthly',
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
          budgetLimit: { amount: props.monthlyBudgetUsd, unit: 'USD' },
        },
        notificationsWithSubscribers: [
          { notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold: 80, thresholdType: 'PERCENTAGE' }, subscribers },
          { notification: { notificationType: 'FORECASTED', comparisonOperator: 'GREATER_THAN', threshold: 100, thresholdType: 'PERCENTAGE' }, subscribers },
        ],
      });
    }

    // --------------------------------------------------------------- outputs
    new CfnOutput(this, 'AppUrl', {
      value: `${props.certificateArn ? 'https' : 'http'}://${alb.loadBalancerDnsName}`,
      description: 'Point a DNS record here, or open it directly',
    });
    new CfnOutput(this, 'AlertsTopicArn', { value: alerts.topicArn });
  }
}

/**
 * IAM resources for bedrock:InvokeModel. A cross-region inference profile ID
 * (e.g. "eu.amazon.nova-micro-v1:0") needs the profile ARN plus the underlying
 * foundation model in every region the profile can route to.
 */
function bedrockResourceArns(stack: Stack, modelId: string): string[] {
  const profileMatch = /^(us|eu|apac|global)\.(.+)$/.exec(modelId);
  if (!profileMatch) {
    return [`arn:${stack.partition}:bedrock:${stack.region}::foundation-model/${modelId}`];
  }
  return [
    `arn:${stack.partition}:bedrock:${stack.region}:${stack.account}:inference-profile/${modelId}`,
    `arn:${stack.partition}:bedrock:*::foundation-model/${profileMatch[2]}`,
  ];
}
