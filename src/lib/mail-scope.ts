import { getMailService, matchesMailService } from "@/lib/mail-services";

export type MailAccessScope = {
  fromAddress: string;
  service: string;
  toAddress: string;
};

export type MailHeader = {
  name?: string | null;
  value?: string | null;
};

const RECIPIENT_HEADERS = new Set([
  "delivered-to",
  "envelope-to",
  "to",
  "x-original-to",
]);

export function buildScopedGmailQuery(
  baseQuery: string,
  scope?: MailAccessScope
): string {
  const parts = [baseQuery.trim()];

  if (scope) {
    const service = getMailService(scope.service);
    parts.push(
      `from:(${service?.senderQuery ?? scope.fromAddress})`,
      `to:(${scope.toAddress})`
    );
  }

  return parts.filter(Boolean).join(" ");
}

export function messageMatchesScope(
  headers: MailHeader[],
  scope?: MailAccessScope
): boolean {
  if (!scope) {
    return true;
  }

  const fromAddresses = readAddresses(headers, new Set(["from"]));
  const recipientAddresses = readAddresses(headers, RECIPIENT_HEADERS);
  const service = getMailService(scope.service);
  const senderMatches = service
    ? fromAddresses.some((address) => matchesMailService(address, service))
    : fromAddresses.includes(normalizeEmailAddress(scope.fromAddress));

  return (
    senderMatches &&
    recipientAddresses.includes(normalizeEmailAddress(scope.toAddress))
  );
}

export function readPrimarySenderAddress(headers: MailHeader[]): string {
  return readAddresses(headers, new Set(["from"]))[0] ?? "";
}

export function readRecipientAddresses(headers: MailHeader[]): string[] {
  return readAddresses(headers, RECIPIENT_HEADERS);
}

export function readDisplayedRecipientAddresses(
  headers: MailHeader[]
): string[] {
  const toAddresses = readAddresses(headers, new Set(["to"]));

  return toAddresses.length ? toAddresses : readRecipientAddresses(headers);
}

export function extractEmailAddresses(value: string): string[] {
  const matches = value.match(
    /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/gi
  );

  return [...new Set((matches ?? []).map(normalizeEmailAddress))];
}

export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

function readAddresses(headers: MailHeader[], names: Set<string>): string[] {
  return [
    ...new Set(
      headers
        .filter((header) => names.has(header.name?.toLowerCase() ?? ""))
        .flatMap((header) => extractEmailAddresses(header.value ?? ""))
    ),
  ];
}
