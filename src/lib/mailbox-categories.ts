import type { MailGateMessage } from "@/lib/gmail";

export type MailboxCategoryId =
  | "claude-code"
  | "codex"
  | "netflix"
  | "other";

export type AdminMailboxCategoryId = Exclude<MailboxCategoryId, "other">;

export type MailboxCategory = {
  id: MailboxCategoryId;
  label: string;
};

type AdminMailboxCategory = MailboxCategory & {
  id: AdminMailboxCategoryId;
};

export type MailboxGroup = MailboxCategory & {
  messages: MailGateMessage[];
};

export const ADMIN_MAILBOXES: AdminMailboxCategory[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "codex", label: "Codex" },
  { id: "netflix", label: "Netflix" },
];

const CATEGORY_PATTERNS: Record<AdminMailboxCategoryId, RegExp> = {
  "claude-code": /anthropic|claude/i,
  codex: /openai|chatgpt|codex/i,
  netflix: /netflix/i,
};

export function groupAdminMessages(messages: MailGateMessage[]): MailboxGroup[] {
  const groups: MailboxGroup[] = ADMIN_MAILBOXES.map((mailbox) => ({
    ...mailbox,
    messages: [],
  }));
  const other: MailboxGroup = { id: "other", label: "Other", messages: [] };
  const groupsById = new Map(groups.map((group) => [group.id, group]));

  for (const message of messages) {
    const categoryId = classifyAdminMessage(message);
    const group = categoryId === "other" ? other : groupsById.get(categoryId);

    group?.messages.push(message);
  }

  return other.messages.length ? [...groups, other] : groups;
}

export function classifyAdminMessage(
  message: Pick<
    MailGateMessage,
    "sender" | "senderAddress" | "snippet" | "subject"
  >
): MailboxCategoryId {
  const searchable = [
    message.sender,
    message.senderAddress,
    message.subject,
    message.snippet,
  ].join(" ");

  for (const mailbox of ADMIN_MAILBOXES) {
    if (CATEGORY_PATTERNS[mailbox.id].test(searchable)) {
      return mailbox.id;
    }
  }

  return "other";
}
