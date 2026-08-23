# Mail Gate

Mail Gate is a password-gated Next.js app that reads allowlisted Gmail messages.
Administrators can issue temporary access codes that create a revocable,
15-minute browser session scoped to a service, sender address, and recipient
address.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Gmail API with OAuth refresh token
- Neon Postgres for one-time passes and revocable sessions

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Set the values in `.env.local` before using the app. Keep
`MAILGATE_GMAIL_QUERY` narrow. A good query should include sender and subject
constraints, for example:

```text
from:(login@example.com) subject:(magic link OR sign in)
```

Set `MAILGATE_LINK_HOST_ALLOWLIST` whenever possible so tracking links or
unrelated links from matching emails are not shown.

Each service mailbox shows its own latest 10 matching messages. It does not
apply a second age window. Administrator mailboxes are queried by sender only;
recipient filtering is applied only to temporary access issued to someone else.

## Gmail OAuth Setup

1. Create a Google OAuth client with Gmail API enabled.
2. Add this redirect URI to the OAuth client:

```text
http://localhost:3000/api/google/callback
```

3. Set these values in `.env.local`:

```bash
MAILGATE_ENABLE_OAUTH_SETUP="true"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3000/api/google/callback"
```

4. Restart the dev server and open:

```text
http://localhost:3000/setup
```

5. Click `Connect Gmail`, grant Gmail read-only access, then copy the returned
   `GOOGLE_REFRESH_TOKEN` value into `.env.local`.
6. Set `MAILGATE_ENABLE_OAUTH_SETUP="false"` and restart the dev server.

## Environment

- `DATABASE_URL`: pooled Neon connection used by the application.
- `DATABASE_URL_UNPOOLED`: direct Neon connection used by migrations.
- `MAILGATE_ACCESS_PASSWORD`: administrator password for the mailbox and temporary-access console.
- `MAILGATE_SESSION_SECRET`: long random string used to sign the session cookie.
- `MAILGATE_ENABLE_OAUTH_SETUP`: local-only OAuth token setup switch.
- `GOOGLE_CLIENT_ID`: OAuth client ID for Gmail API.
- `GOOGLE_CLIENT_SECRET`: OAuth client secret for Gmail API.
- `GOOGLE_REDIRECT_URI`: callback URL registered in Google Cloud.
- `GOOGLE_REFRESH_TOKEN`: refresh token with Gmail read-only access.
- `MAILGATE_GMAIL_QUERY`: Gmail search query for allowed messages.
- `MAILGATE_LINK_HOST_ALLOWLIST`: optional comma-separated link domain allowlist.

## Disposable Access

Sign in with the administrator password and open `/admin`. Each generated
code can be redeemed once. Redemption is atomic, the plaintext code is never
stored, and the resulting browser session lasts 15 minutes. The Gmail query and
message normalization both enforce the selected service and recipient.
