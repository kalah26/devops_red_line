import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface GitHubOidcStackProps extends StackProps {
  /** "owner/repo" allowed to deploy. */
  readonly githubRepo: string;
  /** Branch allowed to deploy (default: main). */
  readonly branch?: string;
  /** ARN of an existing GitHub OIDC provider in the account; one is created if omitted. */
  readonly existingProviderArn?: string;
}

/**
 * Lets GitHub Actions deploy without stored AWS keys. The role can only be
 * assumed from the given repo and branch, and can only assume the CDK
 * bootstrap roles (deploy, file/image publishing, lookup) in this account and region.
 *
 * Deploy this stack once by hand: `npx cdk deploy RedLine-GitHubOidc`.
 */
export class GitHubOidcStack extends Stack {
  constructor(scope: Construct, id: string, props: GitHubOidcStackProps) {
    super(scope, id, props);

    const branch = props.branch ?? 'main';
    const providerArn =
      props.existingProviderArn ??
      new iam.OidcProviderNative(this, 'GitHubProvider', {
        url: 'https://token.actions.githubusercontent.com',
        clientIds: ['sts.amazonaws.com'],
      }).oidcProviderArn;

    const role = new iam.Role(this, 'DeployRole', {
      roleName: 'devops-red-line-github-deploy',
      description: `GitHub Actions deploy role for ${props.githubRepo}@${branch}`,
      assumedBy: new iam.WebIdentityPrincipal(providerArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        StringLike: { 'token.actions.githubusercontent.com:sub': `repo:${props.githubRepo}:ref:refs/heads/${branch}` },
      }),
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AssumeCdkBootstrapRoles',
        actions: ['sts:AssumeRole'],
        resources: [`arn:${this.partition}:iam::${this.account}:role/cdk-hnb659fds-*-${this.account}-${this.region}`],
      }),
    );

    new CfnOutput(this, 'DeployRoleArn', {
      value: role.roleArn,
      description: 'Set as the AWS_DEPLOY_ROLE_ARN repository variable in GitHub',
    });
  }
}
