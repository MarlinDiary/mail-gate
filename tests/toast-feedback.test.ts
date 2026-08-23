import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

test("the root layout mounts the shadcn Sonner toaster", () => {
  const layout = source("src/app/layout.tsx");

  assert.match(layout, /components\/ui\/sonner/);
  assert.match(layout, /<Toaster\b/);
});

test("login errors use a toast instead of an inline alert", () => {
  const loginForm = source("src/components/login-form.tsx");

  assert.match(loginForm, /toast\.error\(/);
  assert.doesNotMatch(loginForm, /<Alert\b/);
});

test("temporary access actions report create, copy, and revoke feedback with toasts", () => {
  const createForm = source("src/components/create-access-form.tsx");
  const revokeButton = source("src/components/revoke-grant-button.tsx");

  assert.match(createForm, /toast\.success\(/);
  assert.match(createForm, /toast\.error\(/);
  assert.doesNotMatch(createForm, /<Alert\b|<FieldError\b/);
  assert.match(revokeButton, /toast\.success\(/);
  assert.match(revokeButton, /toast\.error\(/);
});

test("mailbox refresh and OAuth callback feedback use toasts", () => {
  const mailbox = source("src/components/mailbox-shell.tsx");
  const setupFeedback = source("src/components/setup-feedback.tsx");

  assert.match(mailbox, /toast\.success\(/);
  assert.match(mailbox, /toast\.error\(/);
  assert.match(setupFeedback, /toast\.success\(/);
  assert.match(setupFeedback, /toast\.error\(/);
});
