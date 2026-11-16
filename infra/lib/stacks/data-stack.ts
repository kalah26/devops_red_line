import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DataStackProps extends StackProps {
  readonly vpc: ec2.IVpc;
}

/**
 * Stateful resources: customer-managed KMS key, PostgreSQL on RDS in isolated
 * subnets, and the application secrets in Secrets Manager.
 */
export class DataStack extends Stack {
  public readonly key: kms.Key;
  public readonly database: rds.DatabaseInstance;
  public readonly djangoSecret: secretsmanager.Secret;
  public readonly databaseName = 'odcdb';

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    this.key = new kms.Key(this, 'AppKey', {
      alias: 'alias/devops-red-line',
      description: 'Encrypts RDS, Secrets Manager secrets and the SNS alerts topic for DevOps Red Line',
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
      pendingWindow: Duration.days(7),
    });

    // CloudWatch alarms must be able to publish to the KMS-encrypted SNS topic.
    this.key.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudWatchAlarmsToUseKey',
        principals: [new iam.ServicePrincipal('cloudwatch.amazonaws.com')],
        actions: ['kms:Decrypt', 'kms:GenerateDataKey*'],
        resources: ['*'],
        conditions: { StringEquals: { 'aws:SourceAccount': this.account } },
      }),
    );

    this.database = new rds.DatabaseInstance(this, 'Postgres', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      databaseName: this.databaseName,
      port: 5433, // non-default port
      credentials: rds.Credentials.fromGeneratedSecret('odc', { encryptionKey: this.key }),
      storageEncrypted: true,
      storageEncryptionKey: this.key,
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      storageType: rds.StorageType.GP3,
      multiAz: false,
      backupRetention: Duration.days(7),
      deleteAutomatedBackups: true,
      enablePerformanceInsights: false,
      cloudwatchLogsExports: ['postgresql'],
      iamAuthentication: true,
      autoMinorVersionUpgrade: true,
      parameters: { 'rds.force_ssl': '1' },
      // Demo environment: a final snapshot is kept on `cdk destroy`.
      deletionProtection: false,
      removalPolicy: RemovalPolicy.SNAPSHOT,
    });

    this.djangoSecret = new secretsmanager.Secret(this, 'DjangoSecretKey', {
      description: 'Django SECRET_KEY (also signs the JWTs verified by the assistant Lambda)',
      encryptionKey: this.key,
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
