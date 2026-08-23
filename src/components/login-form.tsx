"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useActionState } from "react";
import * as React from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { loginAction, type LoginState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};

export function LoginForm({ disabled = false }: { disabled?: boolean }) {
  const [state, formAction] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = React.useState(false);

  React.useEffect(() => {
    if (state.error && state.feedbackId) {
      toast.error("Sign in failed", { description: state.error });
    }
  }, [state.error, state.feedbackId]);

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-5">
        <Label className="block" htmlFor="password">
          <span className="sr-only">Access password</span>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="one-time-code"
              className="h-12 rounded-lg bg-background pr-12 text-base shadow-none placeholder:text-muted-foreground/45 focus-visible:border-input focus-visible:ring-0"
              disabled={disabled}
              placeholder="Password or one-time code"
              required
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-3 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground/60 focus-visible:outline-none"
              disabled={disabled}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? (
                <EyeIcon className="size-4" aria-hidden="true" />
              ) : (
                <EyeOffIcon className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </Label>
        <SubmitButton disabled={disabled} />
      </form>
    </div>
  );
}

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const status = useFormStatus();

  return (
    <Button
      className="h-12 w-full rounded-lg focus-visible:ring-0 disabled:bg-primary disabled:text-primary-foreground disabled:opacity-100"
      type="submit"
      disabled={disabled || status.pending}
    >
      {status.pending ? "Checking..." : "Sign in"}
    </Button>
  );
}
