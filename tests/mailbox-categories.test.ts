import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_MAILBOXES,
  groupAdminMessages,
} from "../src/lib/mailbox-categories";
import type { MailGateMessage } from "../src/lib/gmail";

function message(
  id: string,
  senderAddress: string,
  subject: string
): MailGateMessage {
  return {
    bodyHtml: "",
    bodyText: "",
    bodyType: "text",
    id,
    receivedAt: "2026-08-23T00:00:00.000Z",
    recipientAddresses: ["mailbox@example.com"],
    sender: senderAddress,
    senderAddress,
    snippet: "",
    subject,
    threadId: id,
  };
}

test("administrator inboxes keep Claude Code, Codex, and Netflix separate", () => {
  assert.deepEqual(
    ADMIN_MAILBOXES.map(({ id, label }) => ({ id, label })),
    [
      { id: "claude-code", label: "Claude Code" },
      { id: "codex", label: "Codex" },
      { id: "netflix", label: "Netflix" },
    ]
  );

  const groups = groupAdminMessages([
    message("claude", "no-reply@anthropic.com", "Your Claude Code sign-in code"),
    message("codex", "noreply@openai.com", "Your Codex verification code"),
    message("netflix", "info@account.netflix.com", "Complete your Netflix sign-in"),
  ]);

  assert.deepEqual(
    groups.map((group) => [group.label, group.messages.map(({ id }) => id)]),
    [
      ["Claude Code", ["claude"]],
      ["Codex", ["codex"]],
      ["Netflix", ["netflix"]],
    ]
  );
});

test("unrecognized mail remains available in a separate Other inbox", () => {
  const groups = groupAdminMessages([
    message("other", "hello@example.com", "Your sign-in code"),
  ]);

  assert.deepEqual(
    groups.map((group) => [group.label, group.messages.map(({ id }) => id)]),
    [
      ["Claude Code", []],
      ["Codex", []],
      ["Netflix", []],
      ["Other", ["other"]],
    ]
  );
});
