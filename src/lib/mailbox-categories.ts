import type { MailGateMessage } from "@/lib/gmail";
import { classifyMailService, MAIL_SERVICES } from "@/lib/mail-services";

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
  ...MAIL_SERVICES.map(({ id, label }) => ({ id, label })),
];

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
  return classifyMailService(message.senderAddress)?.id ?? "other";
}
