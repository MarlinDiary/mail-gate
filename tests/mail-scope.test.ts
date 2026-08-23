import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminGmailQueries,
  buildScopedGmailQuery,
  extractEmailAddresses,
  messageMatchesScope,
  readDisplayedRecipientAddresses,
  readRecipientAddresses,
} from "../src/lib/mail-scope";

const scope = {
  fromAddress: "no-reply@anthropic.com",
  service: "Anthropic",
  toAddress: "claude-user@example.com",
};

test("scoped Gmail query combines base query, service sender, and To without a time window", () => {
  assert.equal(
    buildScopedGmailQuery("subject:(sign in)", scope),
    "subject:(sign in) from:(mail.anthropic.com) to:(claude-user@example.com)"
  );
});

test("administrator mailbox plans a separate From-only query per service", () => {
  assert.deepEqual(buildAdminGmailQueries("subject:(sign in)"), [
    "subject:(sign in) from:(mail.anthropic.com)",
    "subject:(sign in) from:(noreply@tm.openai.com)",
    "subject:(sign in) from:(info@account.netflix.com)",
  ]);
});

test("historical recipient discovery uses sender-only queries", () => {
  assert.deepEqual(buildAdminGmailQueries(""), [
    "from:(mail.anthropic.com)",
    "from:(noreply@tm.openai.com)",
    "from:(info@account.netflix.com)",
  ]);
});

test("administrator mailbox query uses no To or date filter", () => {
  assert.equal(
    buildScopedGmailQuery("subject:(sign in)"),
    "subject:(sign in)"
  );
});

test("mail scope matches case-insensitive sender and original recipient headers", () => {
  const headers = [
    {
      name: "From",
      value: "Anthropic <NO-REPLY-12345@MAIL.ANTHROPIC.COM>",
    },
    { name: "To", value: "University mailbox <inbox@auckland.ac.nz>" },
    { name: "X-Original-To", value: "Claude User <claude-user@example.com>" },
  ];

  assert.equal(messageMatchesScope(headers, scope), true);
  assert.deepEqual(readRecipientAddresses(headers), [
    "inbox@auckland.ac.nz",
    "claude-user@example.com",
  ]);
  assert.deepEqual(readDisplayedRecipientAddresses(headers), [
    "inbox@auckland.ac.nz",
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
