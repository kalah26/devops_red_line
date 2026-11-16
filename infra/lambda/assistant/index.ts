/**
 * Profile assistant behind the ALB at POST /api/assistant.
 *
 * - Only signed-in users: verifies the app's own JWT (djangorestframework-simplejwt,
 *   HS256 signed with the Django SECRET_KEY read from Secrets Manager).
 * - Calls Amazon Bedrock (Converse API) with a short system prompt and a token cap.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ALBEvent, ALBResult } from 'aws-lambda';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const bedrock = new BedrockRuntimeClient({});
const secrets = new SecretsManagerClient({});

const MODEL_ID = process.env.MODEL_ID ?? '';
const SECRET_ARN = process.env.DJANGO_SECRET_ARN ?? '';
const MAX_MESSAGE_LENGTH = 1000;

const SYSTEM_PROMPT = [
  'You are the help assistant of "DevOps Red Line", a small web app where users register,',
  'sign in and edit their profile (username, email, first name, last name).',
  'Answer questions about using the app and give short, practical tips for writing a good profile.',
  'Keep answers under 120 words. If a question is unrelated to the app or profiles, say so briefly.',
].join(' ');

let signingKey: string | undefined;

async function getSigningKey(): Promise<string> {
  if (!signingKey) {
    const res = await secrets.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
    if (!res.SecretString) throw new Error('Django secret is empty');
    signingKey = res.SecretString;
  }
  return signingKey;
}

function json(statusCode: number, body: unknown): ALBResult {
  return {
    statusCode,
    statusDescription: String(statusCode),
    isBase64Encoded: false,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function base64UrlDecode(part: string): Buffer {
  return Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** Returns the user id if the token is a valid, unexpired simplejwt access token. */
export function verifyAccessToken(token: string, key: string, nowSeconds: number): string | undefined {
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  const [header, payload, signature] = parts;

  let headerJson: { alg?: string };
  let claims: { exp?: number; token_type?: string; user_id?: string | number };
  try {
    headerJson = JSON.parse(base64UrlDecode(header).toString('utf8'));
    claims = JSON.parse(base64UrlDecode(payload).toString('utf8'));
  } catch {
    return undefined;
  }
  if (headerJson.alg !== 'HS256') return undefined;

  const expected = createHmac('sha256', key).update(`${header}.${payload}`).digest();
  const given = base64UrlDecode(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return undefined;

  if (claims.token_type !== 'access') return undefined;
  if (typeof claims.exp !== 'number' || claims.exp <= nowSeconds) return undefined;
  return claims.user_id === undefined ? undefined : String(claims.user_id);
}

export async function handler(event: ALBEvent): Promise<ALBResult> {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST' });

  const auth = event.headers?.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
  const userId = token ? verifyAccessToken(token, await getSigningKey(), Math.floor(Date.now() / 1000)) : undefined;
  if (!userId) return json(401, { error: 'Sign in first' });

  let message: unknown;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : event.body ?? '';
    message = (JSON.parse(raw) as { message?: unknown }).message;
  } catch {
    return json(400, { error: 'Body must be JSON: {"message": "..."}' });
  }
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
    return json(400, { error: `"message" must be a non-empty string of at most ${MAX_MESSAGE_LENGTH} characters` });
  }

  const res = await bedrock.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [{ role: 'user', content: [{ text: message }] }],
      inferenceConfig: { maxTokens: 400, temperature: 0.3 },
    }),
  );

  const reply = res.output?.message?.content?.map((block) => block.text ?? '').join('').trim();
  console.log(JSON.stringify({ userId, inputTokens: res.usage?.inputTokens, outputTokens: res.usage?.outputTokens }));
  return json(200, { reply: reply ?? '' });
}
