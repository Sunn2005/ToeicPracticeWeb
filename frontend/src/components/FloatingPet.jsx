import { useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const PET_WIDTH = 120;
const PET_HEIGHT = 170;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function FloatingPet({ user, role }) {
  const location = useLocation();
  const petRef = useRef(null);
  const dragRef = useRef(null);
  const [position, setPosition] = useState(null);
  const [dragging, setDragging] = useState(false);

  const normalizedRole = String(role || "").toUpperCase();
  const isManagementRole = normalizedRole === "EMPLOYEE" || normalizedRole === "ADMIN";
  const isManagementRoute = /^\/(employee|admin)(?:\/|$)/i.test(location.pathname);
  const isExamRoute = /^\/full-test\/[^/]+\/exam(?:\/|$)/i.test(location.pathname);

  if (!user || normalizedRole !== "USER" || isManagementRole || isManagementRoute || isExamRoute) {
    return null;
  }

  const getInitialPosition = () => ({
    left: Math.max(
      12,
      petRef.current?.getBoundingClientRect().left
        ?? window.innerWidth - PET_WIDTH - 28,
    ),
    top: Math.max(
      12,
      petRef.current?.getBoundingClientRect().top
        ?? window.innerHeight - PET_HEIGHT - 28,
    ),
  });

  const ensurePosition = () => {
    if (position) return position;
    const initialPosition = getInitialPosition();
    setPosition(initialPosition);
    return initialPosition;
  };

  const updatePosition = (left, top) => {
    const currentPosition = ensurePosition();
    const rect = petRef.current?.getBoundingClientRect();
    const width = rect?.width || PET_WIDTH;
    const height = rect?.height || PET_HEIGHT;
    setPosition({
      ...currentPosition,
      left: clamp(left, 8, window.innerWidth - width - 8),
      top: clamp(top, 8, window.innerHeight - height - 8),
    });
  };

  const handlePointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const currentPosition = ensurePosition();
    const rect = petRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - (position?.left ?? currentPosition.left),
      offsetY: event.clientY - (position?.top ?? currentPosition.top),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    updatePosition(
      event.clientX - dragRef.current.offsetX,
      event.clientY - dragRef.current.offsetY,
    );
  };

  const handlePointerUp = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setDragging(false);
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

  const style = position
    ? { left: position.left, top: position.top }
    : { right: 28, bottom: 28 };

  return (
    <button
      ref={petRef}
      type="button"
      className={`floating-pet ${dragging ? "floating-pet--dragging" : ""}`}
      style={style}
      aria-label="CapyToeic pet. Drag to move it around the page."
      title="Kéo mình đi"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <span className="floating-pet__sprite" aria-hidden="true" />
    </button>
  );
}

export default FloatingPet;
