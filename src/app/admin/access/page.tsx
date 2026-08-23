import { ArrowLeftIcon, BanIcon, KeyRoundIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { revokeGrantAction } from "@/app/admin/access/actions";
import { CreateAccessForm } from "@/components/create-access-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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

export const dynamic = "force-dynamic";

export default async function AccessAdminPage() {
  if (!(await hasAdminSession())) {
    redirect("/");
  }

  const grants = await listAccessGrants();

  return (
    <main className="min-h-svh bg-muted/30 px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRoundIcon className="size-5" aria-hidden="true" />
              <h1 className="text-2xl font-semibold tracking-tight">
                Disposable access
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Issue one-time, 15-minute mailbox sessions scoped by service and
              email headers.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeftIcon aria-hidden="true" />
              Mailbox
            </Link>
          </Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Create access pass</CardTitle>
            <CardDescription>
              The plaintext pass is shown once immediately after creation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateAccessForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent passes</CardTitle>
            <CardDescription>
              Pending, active, used, expired, and revoked grants from the latest
              100 records.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
      <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No access passes yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Service</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead>Pass</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {grants.map((grant) => (
          <TableRow key={grant.id}>
            <TableCell className="font-medium">{grant.service}</TableCell>
            <TableCell>
              <span className="block max-w-64 truncate">{grant.fromAddress}</span>
              <span className="block max-w-64 truncate text-xs text-muted-foreground">
                to {grant.toAddress}
              </span>
            </TableCell>
            <TableCell className="font-mono">••••-{grant.codeHint}</TableCell>
            <TableCell>
              <StatusBadge status={grant.status} />
            </TableCell>
            <TableCell>{formatDate(grant.redeemExpiresAt)}</TableCell>
            <TableCell className="text-right">
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
