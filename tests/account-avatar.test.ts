import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const sourceRoot = process.env.MAIL_GATE_SOURCE_ROOT ?? ".";
const expectedAvatarSha256 =
  "b904d045fc1f1894b41cc5b22022dffb39689b99252976a3eea6157d2381dc12";

test("account menu uses the supplied local avatar", () => {
  const mailboxShell = readFileSync(
    resolve(sourceRoot, "src/components/mailbox-shell.tsx"),
    "utf8"
  );

  assert.match(
    mailboxShell,
    /const ACCOUNT_AVATAR_URL = "\/account-avatar\.jpg";/
  );

  const avatar = readFileSync(resolve(sourceRoot, "public/account-avatar.jpg"));
  assert.equal(createHash("sha256").update(avatar).digest("hex"), expectedAvatarSha256);
  assert.deepEqual([...avatar.subarray(0, 3)], [0xff, 0xd8, 0xff]);
});
