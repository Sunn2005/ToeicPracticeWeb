import assert from "node:assert/strict";
import test from "node:test";
import {
  keepFocusInsideDialog,
  visibleFocusableElements,
} from "./focusTrap.js";

function control(name, { visible = true, disabled = false } = {}) {
  return {
    name,
    disabled,
    focusCount: 0,
    getClientRects: () => (visible ? [{ width: 10, height: 10 }] : []),
    focus() {
      this.focusCount += 1;
    },
  };
}

test("focus candidates exclude hidden and disabled controls", () => {
  const hiddenMenu = control("menu", { visible: false });
  const close = control("close");
  const disabled = control("delete", { disabled: true });
  const container = {
    querySelectorAll: () => [hiddenMenu, close, disabled],
  };

  assert.deepEqual(visibleFocusableElements(container), [close]);
});

test("forward and backward Tab wrap between visible controls", () => {
  const first = control("first");
  const last = control("last");
  const container = { querySelectorAll: () => [first, last] };
  let prevented = 0;

  keepFocusInsideDialog(
    { key: "Tab", shiftKey: false, preventDefault: () => { prevented += 1; } },
    container,
    last,
  );
  keepFocusInsideDialog(
    { key: "Tab", shiftKey: true, preventDefault: () => { prevented += 1; } },
    container,
    first,
  );

  assert.equal(prevented, 2);
  assert.equal(first.focusCount, 1);
  assert.equal(last.focusCount, 1);
});

test("the outer dialog does not trap Tab while a child dialog owns focus", () => {
  const first = control("first");
  const last = control("last");
  const container = { querySelectorAll: () => [first, last] };
  let prevented = false;

  const handled = keepFocusInsideDialog(
    { key: "Tab", shiftKey: false, preventDefault: () => { prevented = true; } },
    container,
    last,
    { suspended: true },
  );

  assert.equal(handled, false);
  assert.equal(prevented, false);
  assert.equal(first.focusCount, 0);
});
