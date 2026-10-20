const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "input:not([disabled])",
  "[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function visibleFocusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => (
    !element.disabled
    && element.hidden !== true
    && element.getAttribute?.("aria-hidden") !== "true"
    && typeof element.getClientRects === "function"
    && element.getClientRects().length > 0
  ));
}

export function keepFocusInsideDialog(
  event,
  container,
  activeElement,
  { suspended = false } = {},
) {
  if (suspended || event.key !== "Tab") return false;
  const controls = visibleFocusableElements(container);
  if (!controls.length) return false;

  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && activeElement === first) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}
