import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ClaudeIcon } from "../src/components/service-icons";

test("Claude mailbox uses the original Claude brand mark", () => {
  const markup = renderToStaticMarkup(createElement(ClaudeIcon));

  assert.match(markup, /data-brand-icon="claude"/);
});
