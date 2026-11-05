import assert from "node:assert/strict";
import test from "node:test";
import {
  clampPetPosition,
  hasEffectiveAIChat,
  isDragGesture,
  isKeyboardActivation,
  movementDistance,
} from "./floatingPetInteraction.js";

test("movement distance treats sub-8px pointer jitter as a click", () => {
  assert.equal(movementDistance({ x: 10, y: 10 }, { x: 10, y: 10 }), 0);
  assert.equal(isDragGesture({ x: 0, y: 0 }, { x: 7.99, y: 0 }), false);
  assert.equal(isDragGesture({ x: 0, y: 0 }, { x: 4, y: 4 }), false);
});

test("movement at or beyond 8px is a drag", () => {
  assert.equal(isDragGesture({ x: 0, y: 0 }, { x: 8, y: 0 }), true);
  assert.equal(isDragGesture({ x: 3, y: 4 }, { x: 9, y: 12 }), true);
});

test("only Enter and Space activate Capy from the keyboard", () => {
  assert.equal(isKeyboardActivation("Enter"), true);
  assert.equal(isKeyboardActivation(" "), true);
  assert.equal(isKeyboardActivation("Spacebar"), true);
  assert.equal(isKeyboardActivation("ArrowRight"), false);
});

test("Capy visibility requires an effective AI_CHAT entitlement", () => {
  assert.equal(hasEffectiveAIChat(null), false);
  assert.equal(hasEffectiveAIChat({ effective: false, entitlements: ["AI_CHAT"] }), false);
  assert.equal(hasEffectiveAIChat({ effective: true, entitlements: ["AI_ANALYSIS"] }), false);
  assert.equal(hasEffectiveAIChat({ effective: true, entitlements: ["AI_CHAT"] }), true);
});

test("pet position is clamped inside the viewport inset", () => {
  const bounds = { viewportWidth: 320, viewportHeight: 500, petWidth: 96, petHeight: 136, inset: 8 };

  assert.deepEqual(clampPetPosition({ left: -40, top: -10 }, bounds), { left: 8, top: 8 });
  assert.deepEqual(clampPetPosition({ left: 500, top: 800 }, bounds), { left: 216, top: 356 });
  assert.deepEqual(clampPetPosition({ left: 100, top: 200 }, bounds), { left: 100, top: 200 });
});
