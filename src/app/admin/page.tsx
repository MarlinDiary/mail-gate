import { ArrowLeftIcon, KeyRoundIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateAccessForm } from "@/components/create-access-form";
import { RevokeGrantButton } from "@/components/revoke-grant-button";
import {
  ClaudeIcon,
  CodexIcon,
  NetflixIcon,
} from "@/components/service-icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ACCESS_SESSION_MINUTES,
  listAccessGrants,
  type AccessGrant,
} from "@/lib/access";
import { hasAdminSession } from "@/lib/auth";
import { getMailAccessOptions } from "@/lib/gmail";
import { getMailService, MAIL_SERVICES } from "@/lib/mail-services";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await hasAdminSession())) {
    redirect("/");
  }

  const [grants, services] = await Promise.all([
    listAccessGrants(),
    getMailAccessOptions().catch(() =>
      MAIL_SERVICES.map(({ id, label }) => ({ id, label, toAddresses: [] }))
    ),
  ]);

  return (
    <main className="min-h-svh bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <Button
          asChild
          className="-ml-2.5 text-muted-foreground"
          size="sm"
          variant="ghost"
        >
          <Link href="/">
            <ArrowLeftIcon aria-hidden="true" />
            Mailbox
          </Link>
        </Button>

        <header className="mt-5 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Temporary access
          </h1>
          <p className="text-sm text-muted-foreground">
            Create a code for one service inbox. Once redeemed, it stays valid
            for {ACCESS_SESSION_MINUTES} minutes.
          </p>
        </header>

        <Card className="mt-8 gap-5 rounded-2xl py-5 shadow-xs sm:gap-6 sm:py-6">
          <CardHeader className="px-5 sm:px-6">
            <CardTitle>Create access</CardTitle>
            <CardDescription>
              Pick a service and recipient, then share the generated code.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 sm:px-6">
            <CreateAccessForm
              services={services}
              sessionMinutes={ACCESS_SESSION_MINUTES}
            />
          </CardContent>
        </Card>

        <section className="mt-10">
          <h2 className="px-1 text-sm font-medium">Issued access</h2>
          <Card className="mt-3 gap-0 overflow-hidden rounded-2xl py-0 shadow-xs">
            <GrantList grants={grants} />
          </Card>
        </section>
      </div>
    </main>
  );
}

function GrantList({ grants }: { grants: AccessGrant[] }) {
  if (!grants.length) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <KeyRoundIcon
          aria-hidden="true"
          className="size-5 text-muted-foreground/60"
        />
        <p className="mt-3 text-sm font-medium">No temporary access yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Codes you create will show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/70">
      {grants.map((grant) => (
        <li
          className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5"
          key={grant.id}
        >
          <ServiceMark service={grant.service} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{grant.service}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {grant.toAddress}
              <span aria-hidden="true"> · </span>
              ••••-{grant.codeHint}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={grant.status} />
              <span className="max-w-24 text-right text-[11px] leading-4 text-muted-foreground sm:max-w-none sm:text-xs">
                {describeGrantTiming(grant)}
              </span>
            </div>
            {grant.status === "revoked" ? (
              <div aria-hidden="true" className="w-[3.5rem]" />
            ) : (
              <RevokeGrantButton id={grant.id} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ServiceMark({ service }: { service: string }) {
  const serviceId = getMailService(service)?.id;

  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
      {serviceId === "claude-code" ? (
        <ClaudeIcon aria-hidden="true" className="size-4 text-[#d97757]" />
      ) : serviceId === "codex" ? (
        <CodexIcon aria-hidden="true" className="size-4" />
      ) : serviceId === "netflix" ? (
        <NetflixIcon aria-hidden="true" className="size-4 text-[#e50914]" />
      ) : (
        <KeyRoundIcon
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
      )}
    </div>
  );
}

const STATUS_STYLES: Record<AccessGrant["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-700",
  expired: "bg-amber-500/10 text-amber-700",
  pending: "bg-sky-500/10 text-sky-700",
  revoked: "bg-destructive/10 text-destructive",
  used: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: AccessGrant["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        STATUS_STYLES[status]
      )}
    >
      <span aria-hidden="true" className="size-1 rounded-full bg-current" />
      {status}
    </span>
  );
}

function describeGrantTiming(grant: AccessGrant): string {
  switch (grant.status) {
    case "revoked":
      return grant.revokedAt ? `Revoked ${formatDate(grant.revokedAt)}` : "Revoked";
    case "expired":
      return `Expired ${formatDate(grant.redeemExpiresAt)}`;
    case "used":
      return grant.usedAt ? `Used ${formatDate(grant.usedAt)}` : "Used";
    case "active":
      return grant.sessionExpiresAt
        ? `Session ends ${formatDate(grant.sessionExpiresAt)}`
        : "Session active";
    default:
      return `Expires ${formatDate(grant.redeemExpiresAt)}`;
  }
}

const dateFormatter = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}
