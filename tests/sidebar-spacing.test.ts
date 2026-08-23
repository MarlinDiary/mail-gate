import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const sourceRoot = process.env.MAIL_GATE_SOURCE_ROOT ?? ".";

test("mailbox icon rail keeps service buttons visually separated", () => {
  const mailboxShell = readFileSync(
    resolve(sourceRoot, "src/components/mailbox-shell.tsx"),
    "utf8"
  );
  const railStart = mailboxShell.indexOf(
    '<SidebarHeader className="items-center px-2 pt-3.5 pb-0">'
  );
  const railEnd = mailboxShell.indexOf("</SidebarHeader>", railStart);

  assert.notEqual(railStart, -1);
  assert.notEqual(railEnd, -1);
  assert.match(mailboxShell.slice(railStart, railEnd), /<SidebarMenu className="gap-1">/);
});
