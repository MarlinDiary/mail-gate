export type MailServiceId = "claude-code" | "codex" | "netflix";

export type MailServiceDefinition = {
  aliases: readonly string[];
  id: MailServiceId;
  label: string;
  senderPatterns: readonly RegExp[];
  senderQuery: string;
};

export type AccessServiceOption = Pick<
  MailServiceDefinition,
  "id" | "label"
> & {
  toAddresses: string[];
};

export type MailServiceMetadata = {
  recipientAddresses: string[];
  senderAddress: string;
};

export const MAIL_SERVICES: readonly MailServiceDefinition[] = [
  {
    aliases: ["anthropic", "claude", "claude code"],
    id: "claude-code",
    label: "Claude Code",
    senderPatterns: [/@mail\.anthropic\.com$/i, /@anthropic\.com$/i],
    senderQuery: "mail.anthropic.com",
  },
  {
    aliases: ["codex", "openai", "chatgpt"],
    id: "codex",
    label: "Codex",
    senderPatterns: [/@(?:tm\.)?openai\.com$/i],
    senderQuery: "noreply@tm.openai.com",
  },
  {
    aliases: ["netflix"],
    id: "netflix",
    label: "Netflix",
    senderPatterns: [/@(?:account\.)?netflix\.com$/i],
    senderQuery: "info@account.netflix.com",
  },
] as const;

export function getMailService(
  value: string
): MailServiceDefinition | undefined {
  const normalized = value.trim().toLowerCase();

  return MAIL_SERVICES.find(
    (service) =>
      service.id === normalized ||
      service.label.toLowerCase() === normalized ||
      service.aliases.includes(normalized)
  );
}

export function classifyMailService(
  senderAddress: string
): MailServiceDefinition | undefined {
  return MAIL_SERVICES.find((service) =>
    matchesMailService(senderAddress, service)
  );
}

export function matchesMailService(
  senderAddress: string,
  service: MailServiceDefinition
): boolean {
  return service.senderPatterns.some((pattern) => pattern.test(senderAddress));
}

export function buildAccessServiceOptions(
  messages: MailServiceMetadata[]
): AccessServiceOption[] {
  const addressesByService = new Map<MailServiceId, Set<string>>(
    MAIL_SERVICES.map((service) => [service.id, new Set<string>()])
  );

  for (const message of messages) {
    const service = classifyMailService(message.senderAddress);

    if (!service) {
      continue;
    }

    const addresses = addressesByService.get(service.id);

    for (const address of message.recipientAddresses) {
      if (address) {
        addresses?.add(address.trim().toLowerCase());
      }
    }
  }

  return MAIL_SERVICES.map((service) => ({
    id: service.id,
    label: service.label,
    toAddresses: [...(addressesByService.get(service.id) ?? [])].sort(),
  }));
}
