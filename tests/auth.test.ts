import assert from "node:assert/strict";
import test from "node:test";

import {
  createAdminSessionCookieValue,
  verifyAdminSessionCookie,
} from "../src/lib/auth";

process.env.MAILGATE_SESSION_SECRET = "mailgate-test-session-secret-32-bytes";

test("admin session cookie is signed and expires in the future", () => {
  const value = createAdminSessionCookieValue();
  const session = verifyAdminSessionCookie(value);

  assert.ok(session);
  assert.equal(session.kind, "admin");
  assert.ok(session.expiresAt > Date.now());
});

test("tampered admin session cookie is rejected", () => {
  const value = createAdminSessionCookieValue();
  const tampered = `${value.slice(0, -1)}${value.endsWith("a") ? "b" : "a"}`;

  assert.equal(verifyAdminSessionCookie(tampered), null);
});
