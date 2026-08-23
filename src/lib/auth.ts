import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

import { getGrantSession, type GrantSession } from "@/lib/access";
import { getAccessPassword, getSessionSecret } from "@/lib/config";

export const SESSION_COOKIE_NAME = "mailgate_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type AdminSessionPayload = {
  exp: number;
  iat: number;
  kind: "admin";
  version: 2;
};

export type AdminSession = {
  expiresAt: number;
  kind: "admin";
};

export type CurrentSession = AdminSession | GrantSession;

export async function hasValidSession(): Promise<boolean> {
  return Boolean(await getCurrentSession());
}

export async function hasAdminSession(): Promise<boolean> {
  return (await getCurrentSession())?.kind === "admin";
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawCookie) {
    return null;
  }

  if (rawCookie.startsWith("grant.")) {
    return getGrantSession(rawCookie.slice("grant.".length));
  }

  return verifyAdminSessionCookie(rawCookie);
}

export function verifyAccessPassword(candidate: string): boolean {
  const expected = getAccessPassword();

  if (!expected || !candidate) {
    return false;
  }

  return timingSafeStringEqual(candidate, expected);
}

export function createAdminSessionCookieValue(): string {
  const now = Date.now();
  const payload: AdminSessionPayload = {
    iat: now,
    exp: now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
    kind: "admin",
    version: 2,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signedValue = `admin.${encodedPayload}`;
  const signature = sign(signedValue);

  return `${signedValue}.${signature}`;
}

export function verifyAdminSessionCookie(value: string): AdminSession | null {
  const [kind, encodedPayload, signature] = value.split(".");

  if (kind !== "admin" || !encodedPayload || !signature) {
    return null;
  }

  if (!timingSafeStringEqual(signature, sign(`admin.${encodedPayload}`))) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as AdminSessionPayload;

    if (
      payload.kind !== "admin" ||
      payload.version !== 2 ||
      typeof payload.exp !== "number" ||
      payload.exp <= Date.now()
    ) {
      return null;
    }

    return { expiresAt: payload.exp, kind: "admin" };
  } catch {
    return null;
  }
}

function sign(value: string): string {
  const secret = getSessionSecret();

  if (!secret) {
    return "";
  }

  return createHmac("sha256", secret).update(value).digest("base64url");
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}
