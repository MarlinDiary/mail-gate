import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const sourceRoot = process.env.MAIL_GATE_SOURCE_ROOT ?? ".";

function source(path: string): string {
  return readFileSync(resolve(sourceRoot, path), "utf8");
}

test("temporary access copy matches the reusable active-session behavior", () => {
  const adminPage = source("src/app/admin/page.tsx");
  const createForm = source("src/components/create-access-form.tsx");

  assert.doesNotMatch(adminPage, /single-use/i);
  assert.match(
    adminPage,
    /sessionMinutes=\{ACCESS_SESSION_MINUTES\}/
  );
  assert.match(createForm, /sessionMinutes: number/);
  assert.match(createForm, /\{sessionMinutes\}-minute session/);
  assert.doesNotMatch(createForm, /one 15-minute session/);
});

test("grant timing remains visible below the small-screen breakpoint", () => {
  const adminPage = source("src/app/admin/page.tsx");

  assert.match(adminPage, /\{describeGrantTiming\(grant\)\}/);
  assert.doesNotMatch(
    adminPage,
    /className="hidden[^"]*"[\s\S]{0,120}\{describeGrantTiming\(grant\)\}/
  );
});

test("ephemeral Claude preview configuration stays out of commits", () => {
  const gitignore = source(".gitignore");

  assert.match(gitignore, /^\.claude\/$/m);
});
