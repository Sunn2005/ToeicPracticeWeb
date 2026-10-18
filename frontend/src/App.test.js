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

test("in-progress attempts show a warning without disabling general Capy chat", async () => {
  const chatSource = await readFile(
    new URL("./components/ai-chat/AIChatBox.jsx", import.meta.url),
    "utf8",
  );
  const pickerSource = await readFile(
    new URL("./components/ai-chat/AttemptQuestionContextPicker.jsx", import.meta.url),
    "utf8",
  );

  assert.match(chatSource, /attempts\.find\(\(\{ status \}\) => status === "IN_PROGRESS"\)/);
  assert.match(chatSource, /chatAttemptInProgressSuffix/);
  assert.match(pickerSource, /disabled=\{attempt\.status !== "COMPLETED"\}/);
  assert.match(pickerSource, /onClick=\{\(\) => onCreate\(\)\}/);
});
