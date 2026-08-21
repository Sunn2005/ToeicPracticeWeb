import { useEffect, useRef, useState } from "react";

const DEFAULT_LEFT_WIDTH = 60;
const MIN_LEFT_WIDTH = 35;
const MAX_LEFT_WIDTH = 75;

function clampWidth(value) {
  return Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, value));
}

function ResizableExamLayout({ left, right, leftLabel, rightLabel }) {
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const containerRef = useRef(null);
  const stopDraggingRef = useRef(null);

  useEffect(() => () => stopDraggingRef.current?.(), []);

  const startDragging = (event) => {
    if (window.matchMedia("(max-width: 1279px)").matches) return;

    event.preventDefault();
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds?.width) return;

    document.body.classList.add("exam-is-resizing");
    const move = (moveEvent) => {
      const nextWidth = ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
      setLeftWidth(clampWidth(nextWidth));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.classList.remove("exam-is-resizing");
      stopDraggingRef.current = null;
    };

    stopDraggingRef.current?.();
    stopDraggingRef.current = stop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  const resizeWithKeyboard = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -2 : 2;
    setLeftWidth((current) => clampWidth(current + direction));
  };

  return (
    <div
      ref={containerRef}
      className="exam-split-layout"
      style={{ "--exam-left-width": `calc(${leftWidth}% - 8px)` }}
    >
      <div className="min-w-0">{left}</div>
      <button
        type="button"
        className="exam-split-divider"
        aria-label={`Resize ${leftLabel} and ${rightLabel}`}
        aria-orientation="vertical"
        aria-valuemin={MIN_LEFT_WIDTH}
        aria-valuemax={MAX_LEFT_WIDTH}
        aria-valuenow={Math.round(leftWidth)}
        role="separator"
        title="Drag left or right to resize the two panels"
        onDoubleClick={() => setLeftWidth(DEFAULT_LEFT_WIDTH)}
        onKeyDown={resizeWithKeyboard}
        onPointerDown={startDragging}
      >
        <span aria-hidden="true" className="exam-split-grip">•••</span>
      </button>
      <div className="min-w-0">{right}</div>
    </div>
  );
}

export default ResizableExamLayout;
