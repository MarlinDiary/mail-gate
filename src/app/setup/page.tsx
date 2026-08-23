import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SetupFeedback } from "@/components/setup-feedback";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getConfigStatus,
  getGoogleRedirectUri,
  getOAuthSetupStatus,
} from "@/lib/config";
import {
  decodeOAuthTokenResult,
  OAUTH_RESULT_COOKIE,
} from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

type SetupPageProps = {
  searchParams: Promise<{
    connected?: string;
    error?: string;
  }>;
};

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const params = await searchParams;
  const setupStatus = getOAuthSetupStatus();
  const appStatus = getConfigStatus();
  const cookieStore = await cookies();
  const tokenResult = decodeOAuthTokenResult(
    cookieStore.get(OAUTH_RESULT_COOKIE)?.value ?? ""
  );
  const errorMessage = params.error ? getOAuthErrorMessage(params.error) : "";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <SetupFeedback
          connected={params.connected === "1"}
          errorMessage={errorMessage}
        />
        <header className="space-y-2 border-b pb-5">
          <h1 className="text-2xl font-semibold tracking-normal">Gmail setup</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Use this local-only setup flow to authorize Gmail read-only access and
            generate the refresh token Mail Gate needs.
          </p>
        </header>

        <Card>
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <KeyRound className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>Google OAuth details</CardTitle>
            <CardDescription>
              Add this redirect URI to the Google OAuth client before connecting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="redirect-uri">Redirect URI</Label>
              <Textarea id="redirect-uri" readOnly value={getGoogleRedirectUri()} />
            </div>
            {!setupStatus.ready ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" aria-hidden="true" />
                <AlertTitle>Setup is not enabled</AlertTitle>
                <AlertDescription>
                  Missing: {setupStatus.missing.join(", ") || "none"}.{" "}
                  {setupStatus.warnings.join(" ")}
                </AlertDescription>
              </Alert>
            ) : null}
            {setupStatus.ready ? (
              <Button asChild>
                <Link href="/api/google/connect">Connect Gmail</Link>
              </Button>
            ) : (
              <Button disabled>Connect Gmail</Button>
            )}
          </CardContent>
        </Card>

        {tokenResult ? (
          <Card>
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-md bg-emerald-600 text-white">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </div>
              <CardTitle>Refresh token generated</CardTitle>
              <CardDescription>
                Put this value into `.env.local`, then restart the dev server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="refresh-token">GOOGLE_REFRESH_TOKEN</Label>
                <Textarea
                  id="refresh-token"
                  className="min-h-28 font-mono text-xs"
                  readOnly
                  value={`GOOGLE_REFRESH_TOKEN="${tokenResult.refreshToken}"`}
                />
              </div>
              {tokenResult.scope ? (
                <p className="break-words text-xs text-muted-foreground">
                  Scope: {tokenResult.scope}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>App readiness</CardTitle>
            <CardDescription>
              Mail Gate will show the real feed after these values are present.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {appStatus.ready ? (
              <Alert>
                <CheckCircle2 className="size-4" aria-hidden="true" />
                <AlertTitle>Mail Gate is configured</AlertTitle>
                <AlertDescription>
                  Return to the main page and sign in with the Mail Gate access password.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertCircle className="size-4" aria-hidden="true" />
                <AlertTitle>Still missing values</AlertTitle>
                <AlertDescription>{appStatus.missing.join(", ")}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function getOAuthErrorMessage(code: string): string {
  return (
    code === "missing-refresh-token"
      ? "Google did not return a refresh token. Revoke the app grant in your Google account, then try again with consent prompted."
      : code === "invalid-oauth-state"
        ? "The OAuth state did not match. Start the setup flow again."
        : code === "token-exchange-failed"
          ? "Google returned an error while exchanging the authorization code."
          : `OAuth setup failed: ${code}.`
  );
}
