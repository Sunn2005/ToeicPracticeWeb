export function movementDistance(start, current) {
  if (!start || !current) return 0;
  return Math.hypot(Number(current.x) - Number(start.x), Number(current.y) - Number(start.y));
}

export function isDragGesture(start, current, threshold = 8) {
  return movementDistance(start, current) >= threshold;
}

export function isKeyboardActivation(key) {
  return key === "Enter" || key === " " || key === "Spacebar";
}

export function hasEffectiveAIChat(subscription) {
  return subscription?.effective === true
    && Array.isArray(subscription.entitlements)
    && subscription.entitlements.includes("AI_CHAT");
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function clampPetPosition(position, bounds) {
  const inset = Number(bounds.inset ?? 8);
  return {
    left: clamp(
      Number(position.left),
      inset,
      Number(bounds.viewportWidth) - Number(bounds.petWidth) - inset,
    ),
    top: clamp(
      Number(position.top),
      inset,
      Number(bounds.viewportHeight) - Number(bounds.petHeight) - inset,
    ),
  };
}
