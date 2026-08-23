"use client";

import { BanIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { revokeGrantAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function RevokeGrantButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);

  async function revoke() {
    setPending(true);

    try {
      const result = await revokeGrantAction(id);

      if (result.error) {
        toast.error("Access not revoked", { description: result.error });
        return;
      }

      toast.success("Access revoked", { description: result.message });
    } catch {
      toast.error("Access not revoked", {
        description: "Unable to revoke temporary access.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      disabled={pending}
      onClick={() => void revoke()}
      size="sm"
      type="button"
      variant="ghost"
    >
      <BanIcon aria-hidden="true" />
      {pending ? "Revoking..." : "Revoke"}
    </Button>
  );
}
