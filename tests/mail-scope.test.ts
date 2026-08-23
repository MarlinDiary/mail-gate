import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScopedGmailQuery,
  extractEmailAddresses,
  messageMatchesScope,
  readRecipientAddresses,
} from "../src/lib/mail-scope";

const scope = {
  fromAddress: "no-reply@anthropic.com",
  service: "Anthropic",
  toAddress: "claude-user@example.com",
};

test("scoped Gmail query combines base query, From, To, and time window", () => {
  assert.equal(
    buildScopedGmailQuery("subject:(sign in)", 25, scope),
    "subject:(sign in) from:(no-reply@anthropic.com) to:(claude-user@example.com) newer_than:2d"
  );
});

test("mail scope matches case-insensitive sender and original recipient headers", () => {
  const headers = [
    { name: "From", value: "Anthropic <NO-REPLY@ANTHROPIC.COM>" },
    { name: "To", value: "University mailbox <inbox@auckland.ac.nz>" },
    { name: "X-Original-To", value: "Claude User <claude-user@example.com>" },
  ];

  assert.equal(messageMatchesScope(headers, scope), true);
  assert.deepEqual(readRecipientAddresses(headers), [
    "inbox@auckland.ac.nz",
    "claude-user@example.com",
  ]);
});

test("mail scope rejects a different sender or recipient", () => {
  assert.equal(
    messageMatchesScope(
      [
        { name: "From", value: "attacker@example.net" },
        { name: "To", value: "claude-user@example.com" },
      ],
      scope
    ),
    false
  );
});

test("email extraction handles display names and multiple recipients", () => {
  assert.deepEqual(
    extractEmailAddresses(
      "Person One <one@example.com>, Person Two <TWO@example.org>"
    ),
    ["one@example.com", "two@example.org"]
  );
});
