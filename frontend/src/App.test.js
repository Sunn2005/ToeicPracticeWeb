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

test("blocked Capy chat guides the learner to attempt history", async () => {
  const chatSource = await readFile(
    new URL("./components/ai-chat/AIChatBox.jsx", import.meta.url),
    "utf8",
  );
  const translationsSource = await readFile(
    new URL("./i18n/translations.js", import.meta.url),
    "utf8",
  );

  assert.match(chatSource, /chat\.errorCode === "CHAT_BLOCKED_DURING_ATTEMPT"/);
  assert.match(chatSource, /to="\/history"/);
  assert.match(chatSource, /t\("chatViewAttemptHistory"\)/);
  assert.match(translationsSource, /chatViewAttemptHistory: "View attempt history"/);
  assert.match(translationsSource, /chatViewAttemptHistory: "Xem lịch sử làm bài"/);
});
