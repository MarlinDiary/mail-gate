import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { getSessionSecret } from "@/lib/config";
import { getDatabase } from "@/lib/db";
import {
  normalizeEmailAddress,
  type MailAccessScope,
} from "@/lib/mail-scope";
import { getMailService } from "@/lib/mail-services";

export const ACCESS_SESSION_MINUTES = 15;
export const MAX_GRANT_LIFETIME_HOURS = 24 * 7;

const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ACCESS_CODE_LENGTH = 12;
const EMAIL_PATTERN =
  /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

type AccessGrantRow = {
  code_hint: string;
  created_at: Date | string;
  from_address: string;
  id: string;
  redeem_expires_at: Date | string;
  revoked_at: Date | string | null;
  service: string;
  session_expires_at: Date | string | null;
  to_address: string;
  used_at: Date | string | null;
};

export type AccessGrantStatus =
  | "active"
  | "expired"
  | "pending"
  | "revoked"
  | "used";

export type AccessGrant = MailAccessScope & {
  codeHint: string;
  createdAt: string;
  id: string;
  redeemExpiresAt: string;
  revokedAt: string | null;
  sessionExpiresAt: string | null;
  status: AccessGrantStatus;
  usedAt: string | null;
};

export type GrantSession = MailAccessScope & {
  expiresAt: number;
  grantId: string;
  kind: "grant";
};

export type CreatedAccessGrant = {
  code: string;
  grant: AccessGrant;
};

export type CreateAccessGrantInput = MailAccessScope & {
  expiresInHours: number;
};

export async function createAccessGrant(
  input: CreateAccessGrantInput
): Promise<CreatedAccessGrant> {
  const normalized = validateGrantInput(input);
  const id = randomUUID();
  const code = generateAccessCode();
  const normalizedCode = normalizeAccessCode(code);
  const codeHash = hashAccessValue("code", normalizedCode);
  const codeHint = normalizedCode.slice(-4);
  const redeemExpiresAt = new Date(
    Date.now() + normalized.expiresInHours * 60 * 60 * 1000
  );
  const sql = getDatabase();
  const rows = (await sql`
    INSERT INTO mailgate_access_grants (
      id,
      code_hash,
      code_hint,
      service,
      from_address,
      to_address,
      redeem_expires_at
    ) VALUES (
      ${id},
      ${codeHash},
      ${codeHint},
      ${normalized.service},
      ${normalized.fromAddress},
      ${normalized.toAddress},
      ${redeemExpiresAt.toISOString()}
    )
    RETURNING
      id,
      code_hint,
      service,
      from_address,
      to_address,
      created_at,
      redeem_expires_at,
      used_at,
      session_expires_at,
      revoked_at
  `) as AccessGrantRow[];

  return {
    code,
    grant: mapGrant(rows[0]),
  };
}

export async function consumeAccessCode(
  candidate: string
): Promise<{ session: GrantSession; sessionToken: string } | null> {
  const normalizedCode = normalizeAccessCode(candidate);

  if (normalizedCode.length !== ACCESS_CODE_LENGTH) {
    return null;
  }

  const sessionToken = randomBytes(32).toString("base64url");
  const sessionHash = hashAccessValue("session", sessionToken);
  const sessionExpiresAt = new Date(
    Date.now() + ACCESS_SESSION_MINUTES * 60 * 1000
  );
  const sql = getDatabase();
  const rows = (await sql`
    UPDATE mailgate_access_grants
    SET
      used_at = now(),
      session_hash = ${sessionHash},
      session_expires_at = ${sessionExpiresAt.toISOString()}
    WHERE code_hash = ${hashAccessValue("code", normalizedCode)}
      AND used_at IS NULL
      AND revoked_at IS NULL
      AND redeem_expires_at > now()
    RETURNING
      id,
      service,
      from_address,
      to_address,
      session_expires_at
  `) as Array<
    Pick<
      AccessGrantRow,
      "from_address" | "id" | "service" | "session_expires_at" | "to_address"
    >
  >;

  const row = rows[0];

  if (!row?.session_expires_at) {
    return null;
  }

  return {
    sessionToken,
    session: {
      expiresAt: asDate(row.session_expires_at).getTime(),
      fromAddress: row.from_address,
      grantId: row.id,
      kind: "grant",
      service: row.service,
      toAddress: row.to_address,
    },
  };
}

export async function getGrantSession(
  sessionToken: string
): Promise<GrantSession | null> {
  if (!sessionToken) {
    return null;
  }

  const sql = getDatabase();
  const rows = (await sql`
    SELECT
      id,
      service,
      from_address,
      to_address,
      session_expires_at
    FROM mailgate_access_grants
    WHERE session_hash = ${hashAccessValue("session", sessionToken)}
      AND revoked_at IS NULL
      AND session_expires_at > now()
    LIMIT 1
  `) as Array<
    Pick<
      AccessGrantRow,
      "from_address" | "id" | "service" | "session_expires_at" | "to_address"
    >
  >;
  const row = rows[0];

  if (!row?.session_expires_at) {
    return null;
  }

  return {
    expiresAt: asDate(row.session_expires_at).getTime(),
    fromAddress: row.from_address,
    grantId: row.id,
    kind: "grant",
    service: row.service,
    toAddress: row.to_address,
  };
}

export async function endGrantSession(sessionToken: string): Promise<void> {
  if (!sessionToken) {
    return;
  }

  const sql = getDatabase();
  await sql`
    UPDATE mailgate_access_grants
    SET session_expires_at = now()
    WHERE session_hash = ${hashAccessValue("session", sessionToken)}
  `;
}

export async function listAccessGrants(): Promise<AccessGrant[]> {
  const sql = getDatabase();
  const rows = (await sql`
    SELECT
      id,
      code_hint,
      service,
      from_address,
      to_address,
      created_at,
      redeem_expires_at,
      used_at,
      session_expires_at,
      revoked_at
    FROM mailgate_access_grants
    ORDER BY created_at DESC
    LIMIT 100
  `) as AccessGrantRow[];

  return rows.map(mapGrant);
}

export async function revokeAccessGrant(id: string): Promise<boolean> {
  const sql = getDatabase();
  const rows = (await sql`
    UPDATE mailgate_access_grants
    SET
      revoked_at = COALESCE(revoked_at, now()),
      session_expires_at = now()
    WHERE id = ${id}
      AND revoked_at IS NULL
    RETURNING id
  `) as Array<{ id: string }>;

  return rows.length === 1;
}

export function normalizeAccessCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function generateAccessCode(): string {
  const bytes = randomBytes(ACCESS_CODE_LENGTH);
  const characters = Array.from(
    bytes,
    (byte) => ACCESS_CODE_ALPHABET[byte % ACCESS_CODE_ALPHABET.length]
  ).join("");

  return characters.match(/.{1,4}/g)?.join("-") ?? characters;
}

function validateGrantInput(input: CreateAccessGrantInput): CreateAccessGrantInput {
  const service = input.service.trim();
  const fromAddress = normalizeEmailAddress(input.fromAddress);
  const toAddress = normalizeEmailAddress(input.toAddress);
  const expiresInHours = Math.floor(input.expiresInHours);

  if (service.length < 2 || service.length > 80) {
    throw new Error("Service must be between 2 and 80 characters.");
  }

  const knownService = getMailService(service);
  const validSender =
    EMAIL_PATTERN.test(fromAddress) || knownService?.senderQuery === fromAddress;

  if (!validSender || !EMAIL_PATTERN.test(toAddress)) {
    throw new Error("From and To must be valid email addresses.");
  }

  if (
    !Number.isFinite(expiresInHours) ||
    expiresInHours < 1 ||
    expiresInHours > MAX_GRANT_LIFETIME_HOURS
  ) {
    throw new Error("Access code lifetime must be between 1 hour and 7 days.");
  }

  return { expiresInHours, fromAddress, service, toAddress };
}

function mapGrant(row: AccessGrantRow): AccessGrant {
  const now = Date.now();
  const redeemExpiresAt = asDate(row.redeem_expires_at);
  const sessionExpiresAt = row.session_expires_at
    ? asDate(row.session_expires_at)
    : null;
  let status: AccessGrantStatus = "pending";

  if (row.revoked_at) {
    status = "revoked";
  } else if (row.used_at) {
    status = sessionExpiresAt && sessionExpiresAt.getTime() > now ? "active" : "used";
  } else if (redeemExpiresAt.getTime() <= now) {
    status = "expired";
  }

  return {
    codeHint: row.code_hint,
    createdAt: asDate(row.created_at).toISOString(),
    fromAddress: row.from_address,
    id: row.id,
    redeemExpiresAt: redeemExpiresAt.toISOString(),
    revokedAt: row.revoked_at ? asDate(row.revoked_at).toISOString() : null,
    service: row.service,
    sessionExpiresAt: sessionExpiresAt?.toISOString() ?? null,
    status,
    toAddress: row.to_address,
    usedAt: row.used_at ? asDate(row.used_at).toISOString() : null,
  };
}

function hashAccessValue(kind: "code" | "session", value: string): string {
  const secret = getSessionSecret();

  if (!secret) {
    throw new Error("MAILGATE_SESSION_SECRET is not configured.");
  }

  return createHmac("sha256", secret)
    .update(`mailgate:${kind}:${value}`)
    .digest("hex");
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}
