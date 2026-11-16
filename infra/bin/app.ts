import { App, Tags, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { AppStack } from '../lib/stacks/app-stack';
import { DataStack } from '../lib/stacks/data-stack';
import { GitHubOidcStack } from '../lib/stacks/github-oidc-stack';
import { NetworkStack } from '../lib/stacks/network-stack';
import { applyNagSuppressions } from '../lib/nag-suppressions';
import { defaultBedrockModelId } from '../lib/bedrock';

const app = new App();

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;
if (!account || !region) {
  throw new Error('Set AWS credentials and a region (AWS_REGION or AWS profile) before running cdk.');
}
const env = { account, region };

const ctx = (key: string): string | undefined => {
  const value: unknown = app.node.tryGetContext(key);
  return value === undefined || value === null || value === '' ? undefined : String(value);
};

const network = new NetworkStack(app, 'RedLine-Network', { env, description: 'DevOps Red Line: VPC' });

const data = new DataStack(app, 'RedLine-Data', {
  env,
  description: 'DevOps Red Line: KMS, RDS PostgreSQL, secrets',
  vpc: network.vpc,
});

const bedrockModelId = ctx('bedrockModelId') ?? defaultBedrockModelId(region);

new AppStack(app, 'RedLine-App', {
  env,
  description: 'DevOps Red Line: ECS Fargate, ALB, Lambda, Bedrock, alarms',
  vpc: network.vpc,
  key: data.key,
  database: data.database,
  databaseName: data.databaseName,
  djangoSecret: data.djangoSecret,
  bedrockModelId,
  certificateArn: ctx('certificateArn'),
  alertEmail: ctx('alertEmail'),
  monthlyBudgetUsd: Number(ctx('monthlyBudgetUsd') ?? '15'),
  useFargateSpot: ctx('useFargateSpot') !== 'false',
});

new GitHubOidcStack(app, 'RedLine-GitHubOidc', {
  env,
  description: 'DevOps Red Line: GitHub Actions OIDC deploy role',
  githubRepo: ctx('githubRepo') ?? 'kalah26/devops_red_line',
  existingProviderArn: ctx('githubOidcProviderArn'),
});

Tags.of(app).add('project', 'devops-red-line');
Tags.of(app).add('managed-by', 'cdk');

Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));
applyNagSuppressions(app, account, region, bedrockModelId);
