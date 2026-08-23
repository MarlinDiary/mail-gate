"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function SetupFeedback({
  connected,
  errorMessage,
}: {
  connected: boolean;
  errorMessage: string;
}) {
  useEffect(() => {
    if (errorMessage) {
      toast.error("OAuth setup failed", { description: errorMessage });
    } else if (connected) {
      toast.success("Gmail connected", {
        description: "The refresh token is ready below.",
      });
    }
  }, [connected, errorMessage]);

  return null;
}
