import { test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AppStack } from '../lib/stacks/app-stack';
import { DataStack } from '../lib/stacks/data-stack';
import { GitHubOidcStack } from '../lib/stacks/github-oidc-stack';
import { NetworkStack } from '../lib/stacks/network-stack';

const env = { account: '123456789012', region: 'eu-west-1' };

function build(overrides: { certificateArn?: string; alertEmail?: string } = {}) {
  const app = new App();
  const network = new NetworkStack(app, 'Net', { env });
  const data = new DataStack(app, 'Data', { env, vpc: network.vpc });
  const appStack = new AppStack(app, 'App', {
    env,
    vpc: network.vpc,
    key: data.key,
    database: data.database,
    databaseName: data.databaseName,
    djangoSecret: data.djangoSecret,
    bedrockModelId: 'eu.amazon.nova-micro-v1:0',
    monthlyBudgetUsd: 15,
    useFargateSpot: true,
    ...overrides,
  });
  const oidc = new GitHubOidcStack(app, 'Oidc', { env, githubRepo: 'kalah26/devops_red_line' });
  return {
    network: Template.fromStack(network),
    data: Template.fromStack(data),
    app: Template.fromStack(appStack),
    oidc: Template.fromStack(oidc),
  };
}

test('VPC has no NAT gateway and keeps the database in isolated subnets', () => {
  const t = build();
  t.network.resourceCountIs('AWS::EC2::NatGateway', 0);
  t.data.hasResourceProperties('AWS::RDS::DBInstance', {
    StorageEncrypted: true,
    PubliclyAccessible: false,
    DBInstanceClass: 'db.t4g.micro',
    Port: '5433',
  });
});

test('database credentials and Django key live in Secrets Manager with the CMK', () => {
  const t = build();
  t.data.resourceCountIs('AWS::SecretsManager::Secret', 2);
  t.data.allResourcesProperties('AWS::SecretsManager::Secret', { KmsKeyId: Match.anyValue() });
  t.data.hasResourceProperties('AWS::KMS::Key', { EnableKeyRotation: true });
});

test('backend gets secrets from Secrets Manager, never as plain environment variables', () => {
  const t = build();
  t.app.hasResourceProperties('AWS::ECS::TaskDefinition', {
    ContainerDefinitions: [
      Match.objectLike({
        Name: 'backend',
        Secrets: Match.arrayWith([
          Match.objectLike({ Name: 'POSTGRES_PASSWORD' }),
          Match.objectLike({ Name: 'DJANGO_SECRET_KEY' }),
        ]),
        Environment: Match.not(Match.arrayWith([Match.objectLike({ Name: 'POSTGRES_PASSWORD' })])),
      }),
    ],
  });
});

test('ALB routes the assistant, the API and the frontend', () => {
  const t = build();
  const paths = (values: string[]) => ({
    Conditions: Match.arrayWith([Match.objectLike({ PathPatternConfig: { Values: values } })]),
  });
  t.app.hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', { Priority: 10, ...paths(['/api/assistant', '/api/assistant/']) });
  t.app.hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', { Priority: 20 });
  t.app.hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', { Priority: 100, ...paths(['/*']) });
});

test('HTTPS listener and HTTP redirect when a certificate is given', () => {
  const t = build({ certificateArn: 'arn:aws:acm:eu-west-1:123456789012:certificate/abc' });
  t.app.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', { Port: 443, Protocol: 'HTTPS' });
  t.app.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
    Port: 80,
    DefaultActions: [Match.objectLike({ Type: 'redirect' })],
  });
});

test('assistant can only invoke the configured Bedrock model', () => {
  const t = build();
  t.app.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: 'bedrock:InvokeModel',
          Resource: Match.arrayWith([
            { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':bedrock:eu-west-1:123456789012:inference-profile/eu.amazon.nova-micro-v1:0']] },
          ]),
        }),
      ]),
    },
  });
});

test('budget and email alerts only when an alert email is set', () => {
  build().app.resourceCountIs('AWS::Budgets::Budget', 0);
  const t = build({ alertEmail: 'alerts@example.com' });
  t.app.resourceCountIs('AWS::Budgets::Budget', 1);
  t.app.hasResourceProperties('AWS::SNS::Subscription', { Protocol: 'email', Endpoint: 'alerts@example.com' });
});

test('GitHub deploy role is limited to the main branch of the repo', () => {
  const t = build();
  t.oidc.hasResourceProperties('AWS::IAM::Role', {
    AssumeRolePolicyDocument: {
      Statement: [
        Match.objectLike({
          Condition: {
            StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
            StringLike: { 'token.actions.githubusercontent.com:sub': 'repo:kalah26/devops_red_line:ref:refs/heads/main' },
          },
        }),
      ],
    },
  });
});
