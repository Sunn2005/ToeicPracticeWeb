import { useState } from "react";

const TONES = {
  sky: {
    panel: "border-sky-200 bg-sky-50/70",
    header: "border-sky-200 text-sky-800",
    icon: "bg-sky-100 text-sky-700",
    switch: "bg-sky-500",
  },
  emerald: {
    panel: "border-emerald-200 bg-emerald-50/70",
    header: "border-emerald-200 text-emerald-800",
    icon: "bg-emerald-100 text-emerald-700",
    switch: "bg-emerald-500",
  },
  violet: {
    panel: "border-violet-200 bg-violet-50/70",
    header: "border-violet-200 text-violet-800",
    icon: "bg-violet-100 text-violet-700",
    switch: "bg-violet-500",
  },
};

function ReviewTogglePanel({
  title,
  icon = "✦",
  tone = "sky",
  children,
  defaultOpen = true,
  className = "",
}) {
  const [open, setOpen] = useState(defaultOpen);
  const colors = TONES[tone] || TONES.sky;

  return (
    <section className={`overflow-hidden rounded-xl border ${colors.panel} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 border-b px-3.5 py-3 text-left text-sm font-bold transition hover:bg-white/40 ${colors.header}`}
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${colors.icon}`} aria-hidden="true">
          {icon}
        </span>
        <span className="min-w-0 flex-1">{title}</span>
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${open ? colors.switch : "bg-slate-300"}`}
          aria-hidden="true"
        >
          <span
            className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${open ? "translate-x-6" : "translate-x-1"}`}
          />
        </span>
      </button>

      {open && (
        <div className="px-4 py-4 text-sm leading-7 text-slate-700">
          {children}
        </div>
      )}
    </section>
  );
}

export default ReviewTogglePanel;
