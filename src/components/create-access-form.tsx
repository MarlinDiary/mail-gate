"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  createGrantAction,
  type CreateGrantState,
} from "@/app/admin/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: CreateGrantState = {};

export function CreateAccessForm() {
  const [state, formAction] = useActionState(createGrantAction, initialState);

  return (
    <form action={formAction}>
      <FieldGroup>
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="service">Service</FieldLabel>
          <Input
            id="service"
            name="service"
            placeholder="Anthropic or Netflix"
            required
          />
          </Field>
          <Field>
            <FieldLabel htmlFor="expiresInHours">Redeem within</FieldLabel>
            <Select defaultValue="24" name="expiresInHours">
              <SelectTrigger className="w-full" id="expiresInHours">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="6">6 hours</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
                <SelectItem value="72">3 days</SelectItem>
                <SelectItem value="168">7 days</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="fromAddress">From email</FieldLabel>
            <Input
              autoComplete="off"
              id="fromAddress"
              name="fromAddress"
              placeholder="no-reply@example.com"
              required
              type="email"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="toAddress">To email</FieldLabel>
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

        <FieldDescription>
          One redemption, a 15-minute browser session, and only matching From
          and To messages.
        </FieldDescription>

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

        {state.error ? <FieldError>{state.error}</FieldError> : null}

        <CreateButton />
      </FieldGroup>
    </form>
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
