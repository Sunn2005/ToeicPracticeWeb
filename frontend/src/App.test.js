import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mounts the Pro-gated Capy chat shell outside console routes", async () => {
  const appSource = await readFile(new URL("./App.jsx", import.meta.url), "utf8");

  assert.doesNotMatch(appSource, /usesUserShell/);
  assert.match(appSource, /!location\.pathname\.startsWith\("\/console"\)/);
  assert.match(appSource, /<FloatingPet[\s\S]*profile=\{profile\}[\s\S]*onOpenChat=\{openChat\}/);
  assert.match(appSource, /<AIChatBox[\s\S]*open=\{open && enabled\}/);
  assert.match(appSource, /key=\{`\$\{location\.key\}:\$\{user\?\.uid \|\| "guest"\}:\$\{role\}/);
});
