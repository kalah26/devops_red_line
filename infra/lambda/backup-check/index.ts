/**
 * Daily check that RDS automated backups are actually happening.
 * Publishes an alert to SNS when the newest automated snapshot is older than
 * MAX_AGE_HOURS, or missing on an instance older than MAX_AGE_HOURS.
 */
import { DescribeDBInstancesCommand, DescribeDBSnapshotsCommand, RDSClient } from '@aws-sdk/client-rds';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';

const rds = new RDSClient({});
const sns = new SNSClient({});

const DB_INSTANCE_ID = process.env.DB_INSTANCE_ID ?? '';
const TOPIC_ARN = process.env.TOPIC_ARN ?? '';
const MAX_AGE_HOURS = Number(process.env.MAX_AGE_HOURS ?? '26');

export async function handler(): Promise<{ ok: boolean; latest?: string; ageHours?: number }> {
  // A brand-new instance has no automated snapshot yet: don't alert during its first window.
  const instance = await rds.send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: DB_INSTANCE_ID }));
  const createdAt = instance.DBInstances?.[0]?.InstanceCreateTime;
  if (createdAt && (Date.now() - createdAt.getTime()) / 3_600_000 < MAX_AGE_HOURS) {
    console.log(JSON.stringify({ db: DB_INSTANCE_ID, skipped: 'instance younger than MAX_AGE_HOURS' }));
    return { ok: true };
  }

  const res = await rds.send(
    new DescribeDBSnapshotsCommand({ DBInstanceIdentifier: DB_INSTANCE_ID, SnapshotType: 'automated' }),
  );

  const latest = (res.DBSnapshots ?? [])
    .filter((s) => s.Status === 'available' && s.SnapshotCreateTime)
    .sort((a, b) => b.SnapshotCreateTime!.getTime() - a.SnapshotCreateTime!.getTime())[0];

  const ageHours = latest ? (Date.now() - latest.SnapshotCreateTime!.getTime()) / 3_600_000 : undefined;
  const ok = ageHours !== undefined && ageHours <= MAX_AGE_HOURS;

  console.log(JSON.stringify({ db: DB_INSTANCE_ID, latest: latest?.DBSnapshotIdentifier, ageHours, ok }));

  if (!ok) {
    await sns.send(
      new PublishCommand({
        TopicArn: TOPIC_ARN,
        Subject: `[devops-red-line] RDS backup check failed for ${DB_INSTANCE_ID}`,
        Message: latest
          ? `Newest automated snapshot ${latest.DBSnapshotIdentifier} is ${ageHours!.toFixed(1)} hours old (limit ${MAX_AGE_HOURS}h).`
          : `No available automated snapshot found for ${DB_INSTANCE_ID}.`,
      }),
    );
  }
  return { ok, latest: latest?.DBSnapshotIdentifier, ageHours };
}
