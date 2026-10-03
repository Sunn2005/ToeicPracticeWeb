import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mounts the floating pet on learner shell routes", async () => {
  const appSource = await readFile(new URL("./App.jsx", import.meta.url), "utf8");

  assert.doesNotMatch(appSource, /usesUserShell/);
  assert.match(
    appSource,
    /!location\.pathname\.startsWith\("\/console"\) && <FloatingPet user=\{user\} role=\{role\} \/>/,
  );
});
