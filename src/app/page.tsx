import { AlertTriangle, MailIcon } from "lucide-react";

import { DotGrid } from "@/components/dot-grid";
import { LoginForm } from "@/components/login-form";
import { MailboxShell } from "@/components/mailbox-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getCurrentSession } from "@/lib/auth";
import { getConfigStatus, getMailGateAccountEmail } from "@/lib/config";
import {
  getGmailAccountEmail,
  getMailGateFeed,
  MAILGATE_DEFAULT_PAGE_SIZE,
} from "@/lib/gmail";

export const dynamic = "force-dynamic";

export default async function Home() {
  const configStatus = getConfigStatus();
  const session = await getCurrentSession();

  if (!session) {
    return (
      <main className="relative h-svh overflow-hidden overscroll-none bg-background px-6 py-10 text-foreground">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30">
          <DotGrid
            dotSize={2.5}
            gap={20}
            baseColor="#d9d9de"
            activeColor="#8f8f99"
            proximity={96}
            speedTrigger={80}
            shockRadius={140}
            shockStrength={2}
            returnDuration={1.2}
          />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-[360px] flex-col justify-center">
          <div className="space-y-9">
            <header className="space-y-5 text-center">
              <div className="mx-auto flex size-24 items-center justify-center">
                <MailIcon className="size-16 stroke-[1.75]" aria-hidden="true" />
              </div>
              <h1 className="text-3xl font-bold tracking-normal">
                Welcome to Mail Gate
              </h1>
            </header>

            <div className="space-y-4">
              {!configStatus.ready ? (
                <SetupAlert missing={configStatus.missing} />
              ) : null}
              <LoginForm disabled={!configStatus.ready} />
            </div>
          </div>
        </div>

        <p className="fixed inset-x-6 bottom-8 z-10 text-center text-sm text-muted-foreground">
          Having trouble signing in?{" "}
          <a
            href="mailto:cni586@aucklanduni.ac.nz"
            className="font-medium text-muted-foreground"
          >
            Contact us
          </a>
          .
        </p>
      </main>
    );
  }

  let feedError = "";
  let feed = null;
  let accountEmail = getMailGateAccountEmail();
  const scope =
    session.kind === "grant"
      ? {
          fromAddress: session.fromAddress,
          service: session.service,
          toAddress: session.toAddress,
        }
      : undefined;

  if (configStatus.ready) {
    try {
      [feed, accountEmail] = await Promise.all([
        getMailGateFeed({ pageSize: MAILGATE_DEFAULT_PAGE_SIZE, scope }),
        getGmailAccountEmail().catch(() => accountEmail),
      ]);
    } catch (error) {
      console.error(error);
      feedError = "Unable to read Gmail messages.";
    }
  }

  return (
    <MailboxShell
      accountEmail={accountEmail}
      accessGrant={session.kind === "grant" ? session : null}
      feed={feed}
      feedError={feedError}
      isAdmin={session.kind === "admin"}
      inboxLabel={scope ? `${scope.service} Inbox` : "Claude Inbox"}
      missingConfig={configStatus.ready ? [] : configStatus.missing}
    />
  );
}

function SetupAlert({ missing }: { missing: string[] }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="size-4" aria-hidden="true" />
      <AlertTitle>Missing environment variables</AlertTitle>
      <AlertDescription>
        <span className="block break-words font-mono text-xs">
          {missing.join(", ")}
        </span>
      </AlertDescription>
    </Alert>
  );
}
