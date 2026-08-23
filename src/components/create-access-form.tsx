"use client";

import { CopyIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import {
  createGrantAction,
  type CreateGrantState,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
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
  const toAddress =
    recipientByService[serviceId] ?? selectedService?.toAddresses[0] ?? "";

  useEffect(() => {
    if (!state.feedbackId) {
      return;
    }

    if (state.error) {
      toast.error("Code not created", { description: state.error });
    } else if (state.message) {
      toast.success("Access code created", { description: state.message });
    }
  }, [state.error, state.feedbackId, state.message]);

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

    try {
      await navigator.clipboard.writeText(state.code);
      toast.success("Access code copied");
    } catch {
      toast.error("Copy failed", {
        description: "Select the code and copy it manually.",
      });
    }
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
          <Card className="gap-3 border-0 bg-background py-4 shadow-sm ring-1 ring-foreground/5" size="sm">
            <CardHeader className="px-4">
              <CardTitle>Access code</CardTitle>
            </CardHeader>
            <CardContent className="px-4">
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
                  <CopyIcon aria-hidden="true" />
                  Copy
                </span>
              </Button>
            </CardContent>
          </Card>
        ) : null}

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
