const VARIANT_CLASSES = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-sky-100 text-sky-700 ring-sky-200",
  success: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-100 text-amber-800 ring-amber-200",
  danger: "bg-red-100 text-red-700 ring-red-200",
  // Roles
  USER: "bg-sky-100 text-sky-700 ring-sky-200",
  EMPLOYEE: "bg-violet-100 text-violet-700 ring-violet-200",
  ADMIN: "bg-rose-100 text-rose-700 ring-rose-200",
  // Test review status
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  PENDING_REVIEW: "bg-amber-100 text-amber-800 ring-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  REJECTED: "bg-red-100 text-red-700 ring-red-200",
};

export default function Badge({ variant = "neutral", className = "", children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.neutral} ${className}`}
    >
      {children}
    </span>
  );
}
