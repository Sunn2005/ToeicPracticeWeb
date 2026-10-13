import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import {
  clampPetPosition,
  hasEffectiveAIChat,
  isDragGesture,
} from "./floatingPetInteraction.js";

const PET_WIDTH = 120;
const PET_HEIGHT = 170;
const HINT_STORAGE_KEY = "capy-ai-chat-hint-seen-v1";

function shouldShowInitialHint() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(HINT_STORAGE_KEY) !== "true";
  } catch {
    return true;
  }
}

function FloatingPet({ user, role, profile, onOpenChat }) {
  const location = useLocation();
  const { t } = useLanguage();
  const petRef = useRef(null);
  const dragRef = useRef(null);
  const ignoreClickRef = useRef(false);
  const [position, setPosition] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [showHint, setShowHint] = useState(shouldShowInitialHint);

  const normalizedRole = String(role || "").toUpperCase();
  const isManagementRole = normalizedRole === "EMPLOYEE" || normalizedRole === "ADMIN";
  const isManagementRoute = /^\/(employee|admin)(?:\/|$)/i.test(location.pathname);
  const isExamRoute = /^\/full-test\/[^/]+\/exam(?:\/|$)/i.test(location.pathname);
  const hasAIChat = hasEffectiveAIChat(profile?.subscription);
  const canRender = Boolean(user)
    && normalizedRole === "USER"
    && !isManagementRole
    && !isManagementRoute
    && !isExamRoute
    && hasAIChat;

  useEffect(() => {
    if (!canRender || !showHint) return undefined;
    try {
      window.localStorage.setItem(HINT_STORAGE_KEY, "true");
    } catch {
      // The hint still auto-dismisses when storage is unavailable.
    }
    const timeoutId = window.setTimeout(() => setShowHint(false), 6_000);
    return () => window.clearTimeout(timeoutId);
  }, [canRender, showHint]);

  if (!canRender) return null;

  const dismissHint = () => {
    setShowHint(false);
    try {
      window.localStorage.setItem(HINT_STORAGE_KEY, "true");
    } catch {
      // Storage is a presentation enhancement only.
    }
  };

  const openChat = () => {
    dismissHint();
    onOpenChat?.();
  };

  const getInitialPosition = () => ({
    left: Math.max(12, petRef.current?.getBoundingClientRect().left
      ?? window.innerWidth - PET_WIDTH - 28),
    top: Math.max(12, petRef.current?.getBoundingClientRect().top
      ?? window.innerHeight - PET_HEIGHT - 28),
  });

  const ensurePosition = () => {
    if (position) return position;
    const initialPosition = getInitialPosition();
    setPosition(initialPosition);
    return initialPosition;
  };

  const updatePosition = (left, top) => {
    ensurePosition();
    const rect = petRef.current?.getBoundingClientRect();
    setPosition(clampPetPosition(
      { left, top },
      {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        petWidth: rect?.width || PET_WIDTH,
        petHeight: rect?.height || PET_HEIGHT,
        inset: 8,
      },
    ));
  };

  const handlePointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const currentPosition = ensurePosition();
    const rect = petRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      dragged: false,
      offsetX: event.clientX - (position?.left ?? currentPosition.left),
      offsetY: event.clientY - (position?.top ?? currentPosition.top),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const current = { x: event.clientX, y: event.clientY };
    drag.dragged = drag.dragged || isDragGesture(drag.start, current);
    if (!drag.dragged) return;
    setDragging(true);
    updatePosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY);
  };

  const suppressFollowingClick = () => {
    ignoreClickRef.current = true;
    window.setTimeout(() => {
      ignoreClickRef.current = false;
    }, 0);
  };

  const handlePointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const current = { x: event.clientX, y: event.clientY };
    const dragged = drag.dragged || isDragGesture(drag.start, current);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setDragging(false);
    suppressFollowingClick();
    if (!dragged) openChat();
  };

  const handlePointerCancel = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setDragging(false);
    suppressFollowingClick();
  };

  const handleKeyDown = (event) => {
    const offsets = {
      ArrowUp: [0, -16],
      ArrowDown: [0, 16],
      ArrowLeft: [-16, 0],
      ArrowRight: [16, 0],
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const currentPosition = ensurePosition();
    updatePosition(currentPosition.left + offset[0], currentPosition.top + offset[1]);
  };

  const handleClick = () => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }
    openChat();
  };

  const style = position
    ? { left: position.left, top: position.top }
    : { right: 28, bottom: 28 };

  return (
    <button
      ref={petRef}
      type="button"
      className={`floating-pet ${dragging ? "floating-pet--dragging" : ""}`}
      style={style}
      aria-label={t("chatPetAriaLabel")}
      title={t("chatPetAriaLabel")}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
    >
      {showHint && <span className="floating-pet__hint" role="status">{t("chatPetHint")}</span>}
      <span className="floating-pet__hover-label" aria-hidden="true">{t("chatPetHoverLabel")}</span>
      <span className="floating-pet__sprite" aria-hidden="true" />
    </button>
  );
}

export default FloatingPet;
