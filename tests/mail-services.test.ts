import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAccessServiceOptions,
  getMailService,
  preferExternalRecipientOptions,
} from "../src/lib/mail-services";

test("service catalog includes every mailbox service", () => {
  assert.deepEqual(
    ["Claude Code", "Codex", "Netflix"].map((label) =>
      getMailService(label)?.id
    ),
    ["claude-code", "codex", "netflix"]
  );
});

test("recipient choices prefer external To addresses but keep mailbox fallback", () => {
  const options = preferExternalRecipientOptions(
    [
      {
        id: "claude-code",
        label: "Claude Code",
        toAddresses: ["mailbox@example.com", "claude@example.com"],
      },
      {
        id: "codex",
        label: "Codex",
        toAddresses: ["mailbox@example.com"],
      },
      { id: "netflix", label: "Netflix", toAddresses: [] },
    ],
    "MAILBOX@example.com"
  );

  assert.deepEqual(
    options.map((service) => service.toAddresses),
    [["claude@example.com"], ["mailbox@example.com"], []]
  );
});

test("recipient choices are discovered, grouped by sender, and deduplicated", () => {
  const options = buildAccessServiceOptions([
    {
      recipientAddresses: ["claude@example.com", "CLAUDE@example.com"],
      senderAddress: "no-reply-123@mail.anthropic.com",
    },
    {
      recipientAddresses: ["codex@example.com"],
      senderAddress: "noreply@tm.openai.com",
    },
    {
      recipientAddresses: ["netflix@example.com"],
      senderAddress: "info@account.netflix.com",
    },
  ]);

  assert.deepEqual(options, [
    {
      id: "claude-code",
      label: "Claude Code",
      toAddresses: ["claude@example.com"],
    },
    {
      id: "codex",
      label: "Codex",
      toAddresses: ["codex@example.com"],
    },
    {
      id: "netflix",
      label: "Netflix",
      toAddresses: ["netflix@example.com"],
    },
  ]);
});
