import { ArrowLeftIcon, BanIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { revokeGrantAction } from "@/app/admin/actions";
import { CreateAccessForm } from "@/components/create-access-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAccessGrants, type AccessGrant } from "@/lib/access";
import { hasAdminSession } from "@/lib/auth";
import { getMailAccessOptions } from "@/lib/gmail";
import { MAIL_SERVICES } from "@/lib/mail-services";

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
    <main className="min-h-svh bg-muted/20 px-4 py-10 text-foreground sm:px-6 sm:py-14">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Temporary access
          </h1>
          <Button asChild size="sm" variant="outline">
            <Link href="/">
              <ArrowLeftIcon aria-hidden="true" />
              Mailbox
            </Link>
          </Button>
        </header>

        <Card className="gap-6 border-0 bg-muted/50 py-6 shadow-none ring-0" size="sm">
          <CardHeader className="px-5 sm:px-6">
            <CardTitle className="text-base">Create access</CardTitle>
          </CardHeader>
          <CardContent className="px-5 sm:px-6">
            <CreateAccessForm services={services} />
          </CardContent>
        </Card>

        <Card className="gap-4 border-0 bg-transparent py-0 shadow-none ring-0" size="sm">
          <CardHeader className="px-0">
            <CardTitle className="text-base">Issued access</CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden rounded-xl bg-card px-0 shadow-sm ring-1 ring-foreground/5">
            <GrantTable grants={grants} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function GrantTable({ grants }: { grants: AccessGrant[] }) {
  if (!grants.length) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        No temporary access yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Access</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead className="pr-4 text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {grants.map((grant) => (
          <TableRow key={grant.id}>
            <TableCell className="pl-4">
              <span className="block font-medium">{grant.service}</span>
              <span className="block max-w-lg truncate text-xs text-muted-foreground">
                {grant.toAddress} · ••••-{grant.codeHint}
              </span>
            </TableCell>
            <TableCell>
              <StatusBadge status={grant.status} />
            </TableCell>
            <TableCell>{formatDate(grant.redeemExpiresAt)}</TableCell>
            <TableCell className="pr-4 text-right">
              {grant.status === "revoked" ? null : (
                <form action={revokeGrantAction}>
                  <input name="id" type="hidden" value={grant.id} />
                  <Button size="sm" type="submit" variant="ghost">
                    <BanIcon aria-hidden="true" />
                    Revoke
                  </Button>
                </form>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StatusBadge({ status }: { status: AccessGrant["status"] }) {
  const variant =
    status === "active"
      ? "default"
      : status === "revoked"
        ? "destructive"
        : status === "pending"
          ? "secondary"
          : "outline";

  return <Badge variant={variant}>{status}</Badge>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
