import { strict as assert } from 'node:assert';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { verifyAccessToken } from '../lambda/assistant/index';

const KEY = 'test-signing-key';
const NOW = 1_800_000_000;

const b64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

function sign(claims: Record<string, unknown>, key = KEY, alg = 'HS256'): string {
  const header = b64url(JSON.stringify({ alg, typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claims));
  const signature = b64url(createHmac('sha256', key).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${signature}`;
}

const valid = { token_type: 'access', exp: NOW + 300, user_id: 42 };

test('accepts a valid simplejwt access token', () => {
  assert.equal(verifyAccessToken(sign(valid), KEY, NOW), '42');
});

test('rejects a token signed with another key', () => {
  assert.equal(verifyAccessToken(sign(valid, 'other-key'), KEY, NOW), undefined);
});

test('rejects an expired token', () => {
  assert.equal(verifyAccessToken(sign({ ...valid, exp: NOW - 1 }), KEY, NOW), undefined);
});

test('rejects refresh tokens', () => {
  assert.equal(verifyAccessToken(sign({ ...valid, token_type: 'refresh' }), KEY, NOW), undefined);
});

test('rejects alg other than HS256 and malformed tokens', () => {
  assert.equal(verifyAccessToken(sign(valid, KEY, 'none'), KEY, NOW), undefined);
  assert.equal(verifyAccessToken('not-a-jwt', KEY, NOW), undefined);
  assert.equal(verifyAccessToken('a.b.c', KEY, NOW), undefined);
});
