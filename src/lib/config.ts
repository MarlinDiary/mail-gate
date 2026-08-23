const REQUIRED_ENV = [
  "MAILGATE_ACCESS_PASSWORD",
  "MAILGATE_SESSION_SECRET",
  "DATABASE_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "MAILGATE_GMAIL_QUERY",
] as const;

export type ConfigStatus = {
  ready: boolean;
  missing: string[];
  warnings: string[];
};

export type GmailConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
  userId: string;
  query: string;
  linkHostAllowlist: string[];
};

export function getConfigStatus(): ConfigStatus {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  const warnings: string[] = [];

  if (!process.env.MAILGATE_LINK_HOST_ALLOWLIST) {
    warnings.push(
      "MAILGATE_LINK_HOST_ALLOWLIST is not set, so every HTTPS link in matching emails can be shown."
    );
  }

  const password = process.env.MAILGATE_ACCESS_PASSWORD ?? "";

  if (password.length > 0 && password.length < 12) {
    warnings.push("MAILGATE_ACCESS_PASSWORD should be at least 12 characters.");
  }

  return {
    ready: missing.length === 0,
    missing,
    warnings,
  };
}

export function getAccessPassword(): string {
  return process.env.MAILGATE_ACCESS_PASSWORD ?? "";
}

export function getSessionSecret(): string {
  return process.env.MAILGATE_SESSION_SECRET ?? "";
}

export function getGmailConfig(): GmailConfig {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: getGoogleRedirectUri(),
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? "",
    userId: process.env.MAILGATE_GMAIL_USER ?? "me",
    query: process.env.MAILGATE_GMAIL_QUERY ?? "",
    linkHostAllowlist: parseCsv(process.env.MAILGATE_LINK_HOST_ALLOWLIST),
  };
}

export function getMailGateAccountEmail(): string {
  const gmailUser = process.env.MAILGATE_GMAIL_USER?.trim();

  if (gmailUser && gmailUser !== "me") {
    return gmailUser;
  }

  return process.env.MAILGATE_ACCOUNT_EMAIL?.trim() || "Gmail account";
}

export function getOAuthSetupStatus(): ConfigStatus {
  const required = [
    "MAILGATE_ENABLE_OAUTH_SETUP",
    "MAILGATE_SESSION_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  ] as const;
  const missing = required.filter((name) => !process.env[name]);
  const warnings: string[] = [];

  if (process.env.MAILGATE_ENABLE_OAUTH_SETUP !== "true") {
    warnings.push("MAILGATE_ENABLE_OAUTH_SETUP must be set to true for local setup.");
  }

  return {
    ready:
      missing.length === 0 && process.env.MAILGATE_ENABLE_OAUTH_SETUP === "true",
    missing,
    warnings,
  };
}

export function getGoogleRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    "http://localhost:3000/api/google/callback"
  );
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}
