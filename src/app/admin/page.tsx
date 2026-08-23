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
    <main className="min-h-svh bg-muted/30 px-4 py-8 text-foreground">
      <div className="mx-auto max-w-4xl space-y-4">
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

        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle>Create access</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateAccessForm services={services} />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle>Issued access</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
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
