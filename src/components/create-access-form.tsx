"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createGrantAction,
  type CreateGrantState,
} from "@/app/admin/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AccessServiceOption } from "@/lib/mail-services";

const initialState: CreateGrantState = {};

export function CreateAccessForm({
  services,
}: {
  services: AccessServiceOption[];
}) {
  const [state, formAction] = useActionState(createGrantAction, initialState);
  const firstAvailableService =
    services.find((service) => service.toAddresses.length > 0) ?? services[0];
  const [serviceId, setServiceId] = useState(firstAvailableService?.id ?? "");
  const selectedService = services.find((service) => service.id === serviceId);
  const [recipientByService, setRecipientByService] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      services.map((service) => [service.id, service.toAddresses[0] ?? ""])
    )
  );
  const [copiedCode, setCopiedCode] = useState("");
  const toAddress =
    recipientByService[serviceId] ?? selectedService?.toAddresses[0] ?? "";

  function selectService(value: string) {
    const nextService = services.find((service) => service.id === value);
    setServiceId(value as AccessServiceOption["id"]);
    setRecipientByService((current) => ({
      ...current,
      [value]: current[value] ?? nextService?.toAddresses[0] ?? "",
    }));
  }

  function selectRecipient(value: string) {
    setRecipientByService((current) => ({
      ...current,
      [serviceId]: value,
    }));
  }

  async function copyCode() {
    if (!state.code) {
      return;
    }

    await navigator.clipboard.writeText(state.code);
    setCopiedCode(state.code);
  }

  return (
    <form action={formAction}>
      <FieldGroup className="gap-6">
        <div className="grid gap-5 md:grid-cols-[1fr_1.4fr_1fr]">
          <Field>
            <FieldLabel htmlFor="service">Service</FieldLabel>
            <Select
              name="serviceId"
              onValueChange={selectService}
              value={serviceId}
            >
              <SelectTrigger className="w-full" id="service">
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="toAddress">Recipient</FieldLabel>
            <Select
              disabled={!selectedService?.toAddresses.length}
              key={serviceId}
              name="toAddress"
              onValueChange={selectRecipient}
              value={toAddress}
            >
              <SelectTrigger className="w-full" id="toAddress">
                <SelectValue placeholder="No recipient found" />
              </SelectTrigger>
              <SelectContent>
                {selectedService?.toAddresses.map((address) => (
                  <SelectItem key={address} value={address}>
                    {address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="expiresInHours">Code expires after</FieldLabel>
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
        </div>

        {state.code ? (
          <Alert className="border-0 bg-background shadow-sm ring-1 ring-foreground/5">
            <AlertTitle>Access code</AlertTitle>
            <AlertDescription className="space-y-3">
              <Button
                aria-label="Copy access code"
                className="h-auto w-full justify-between bg-muted/70 px-3 py-2.5 font-normal hover:bg-muted"
                onClick={() => void copyCode()}
                type="button"
                variant="ghost"
              >
                <code className="select-all text-base font-semibold tracking-widest text-foreground">
                  {state.code}
                </code>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {copiedCode === state.code ? (
                    <CheckIcon aria-hidden="true" />
                  ) : (
                    <CopyIcon aria-hidden="true" />
                  )}
                  {copiedCode === state.code ? "Copied" : "Copy"}
                </span>
              </Button>
              <span className="text-xs text-muted-foreground">{state.message}</span>
            </AlertDescription>
          </Alert>
        ) : null}

        {state.error ? <FieldError>{state.error}</FieldError> : null}

        <div className="flex justify-end">
          <CreateButton disabled={!toAddress} />
        </div>
      </FieldGroup>
    </form>
  );
}

function CreateButton({ disabled }: { disabled: boolean }) {
  const status = useFormStatus();

  return (
    <Button disabled={disabled || status.pending} size="sm" type="submit">
      {status.pending ? "Creating..." : "Create code"}
    </Button>
  );
}
