"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionCookieValue,
  SESSION_COOKIE_NAME,
  verifyAccessPassword,
} from "@/lib/auth";
import {
  ACCESS_SESSION_MINUTES,
  consumeAccessCode,
  endGrantSession,
} from "@/lib/access";
import { getConfigStatus } from "@/lib/config";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const status = getConfigStatus();

  if (!status.ready) {
    return { error: "Mail Gate is not configured yet." };
  }

  const password = String(formData.get("password") ?? "");
  const cookieStore = await cookies();

  if (verifyAccessPassword(password)) {
    cookieStore.set(SESSION_COOKIE_NAME, createAdminSessionCookieValue(), {
      httpOnly: true,
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    redirect("/");
  }

  let grant = null;

  try {
    grant = await consumeAccessCode(password);
  } catch (error) {
    console.error("Unable to redeem access code.", error);
    return { error: "Sign in is temporarily unavailable." };
  }

  if (grant) {
    cookieStore.set(SESSION_COOKIE_NAME, `grant.${grant.sessionToken}`, {
      httpOnly: true,
      maxAge: ACCESS_SESSION_MINUTES * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    redirect("/");
  }

  return { error: "Incorrect, expired, or already used access code." };
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";

  if (value.startsWith("grant.")) {
    await endGrantSession(value.slice("grant.".length)).catch((error) => {
      console.error("Unable to end grant session.", error);
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);

  redirect("/");
}
