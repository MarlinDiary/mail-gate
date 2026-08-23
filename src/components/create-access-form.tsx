"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  createGrantAction,
  type CreateGrantState,
} from "@/app/admin/access/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CreateGrantState = {};

export function CreateAccessForm() {
  const [state, formAction] = useActionState(createGrantAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Service" name="service">
          <Input
            id="service"
            name="service"
            placeholder="Anthropic or Netflix"
            required
          />
        </Field>
        <Field label="Redeem within" name="expiresInHours">
          <select
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            defaultValue="24"
            id="expiresInHours"
            name="expiresInHours"
          >
            <option value="1">1 hour</option>
            <option value="6">6 hours</option>
            <option value="24">24 hours</option>
            <option value="72">3 days</option>
            <option value="168">7 days</option>
          </select>
        </Field>
        <Field label="From email" name="fromAddress">
          <Input
            autoComplete="off"
            id="fromAddress"
            name="fromAddress"
            placeholder="no-reply@example.com"
            required
            type="email"
          />
        </Field>
        <Field label="To email" name="toAddress">
          <Input
            autoComplete="off"
            id="toAddress"
            name="toAddress"
            placeholder="recipient@example.com"
            required
            type="email"
          />
        </Field>
      </div>

      <p className="text-sm text-muted-foreground">
        The pass works once. The redeemed browser session lasts 15 minutes and
        can only read messages matching this From, To, and service scope.
      </p>

      {state.code ? (
        <Alert>
          <AlertTitle>One-time access pass</AlertTitle>
          <AlertDescription className="space-y-2">
            <code className="block select-all rounded-md bg-muted px-3 py-2 text-base font-semibold tracking-widest text-foreground">
              {state.code}
            </code>
            <span>{state.message}</span>
          </AlertDescription>
        </Alert>
      ) : null}

      {state.error ? (
        <Alert variant="destructive">
          <AlertTitle>Access pass not created</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <CreateButton />
    </form>
  );
}

function Field({
  children,
  label,
  name,
}: {
  children: React.ReactNode;
  label: string;
  name: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
    </div>
  );
}

function CreateButton() {
  const status = useFormStatus();

  return (
    <Button disabled={status.pending} type="submit">
      {status.pending ? "Creating..." : "Create one-time pass"}
    </Button>
  );
}
