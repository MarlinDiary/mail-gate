import assert from "node:assert/strict";
import { after, test } from "node:test";

import {
  consumeAccessCode,
  createAccessGrant,
  generateAccessCode,
  getGrantSession,
  getRemainingSessionMinutes,
  normalizeAccessCode,
  revokeAccessGrant,
} from "../src/lib/access";
import { getDatabase } from "../src/lib/db";

process.env.MAILGATE_SESSION_SECRET ||= "mailgate-test-session-secret-32-bytes";

const createdIds: string[] = [];

after(async () => {
  if (!process.env.DATABASE_URL || !createdIds.length) {
    return;
  }

  const sql = getDatabase();
  await sql.query(
    "DELETE FROM mailgate_access_grants WHERE id = ANY($1::uuid[])",
    [createdIds]
  );
});

test("access codes are human-readable and normalize consistently", () => {
  const code = generateAccessCode();

  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(normalizeAccessCode(` ${code.toLowerCase()} `), code.replaceAll("-", ""));
});

test("remaining session time is rounded up and never negative", () => {
  const now = 1_000_000;

  assert.equal(getRemainingSessionMinutes(now + 15 * 60_000, now), 15);
  assert.equal(getRemainingSessionMinutes(now + 14 * 60_000 - 1, now), 14);
  assert.equal(getRemainingSessionMinutes(now - 1, now), 0);
});

test("a code can be redeemed repeatedly during one 15-minute session and then revoked", async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for integration tests");
  const created = await createAccessGrant({
    expiresInHours: 1,
    fromAddress: "no-reply@anthropic.com",
    service: "Anthropic",
    toAddress: "recipient@example.com",
  });
  createdIds.push(created.grant.id);

  const first = await consumeAccessCode(created.code);
  const second = await consumeAccessCode(created.code);

  assert.ok(first);
  assert.ok(second);
  assert.equal(second.sessionToken, first.sessionToken);
  assert.deepEqual(second.session, first.session);
  assert.equal(first.session.service, "Anthropic");
  assert.equal(first.session.toAddress, "recipient@example.com");
  assert.ok(first.session.expiresAt > Date.now());
  assert.ok(first.session.expiresAt <= Date.now() + 15 * 60 * 1000);
  assert.deepEqual(await getGrantSession(first.sessionToken), first.session);

  assert.equal(await revokeAccessGrant(created.grant.id), true);
  assert.equal(await getGrantSession(first.sessionToken), null);
});

test("concurrent redemption shares one active session", async () => {
  const created = await createAccessGrant({
    expiresInHours: 1,
    fromAddress: "info@account.netflix.com",
    service: "Netflix",
    toAddress: "recipient@example.com",
  });
  createdIds.push(created.grant.id);

  const results = await Promise.all([
    consumeAccessCode(created.code),
    consumeAccessCode(created.code),
  ]);

  assert.equal(results.filter(Boolean).length, 2);
  assert.equal(results[0]?.sessionToken, results[1]?.sessionToken);
});
