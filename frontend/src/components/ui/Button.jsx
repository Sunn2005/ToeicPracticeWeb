import { Link } from "react-router-dom";

const VARIANT_CLASSES = {
  primary:
    "bg-[#2188ee] text-white shadow-sm hover:bg-[#1a74cf] focus-visible:ring-sky-300 disabled:bg-sky-300",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-300 disabled:opacity-60",
  ghost:
    "text-sky-600 hover:bg-sky-50 focus-visible:ring-sky-200 disabled:opacity-60",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-300 disabled:bg-red-300",
  light:
    "bg-white text-[#1486ee] shadow-xl hover:bg-blue-50 focus-visible:ring-white/60 disabled:opacity-60",
};

const SIZE_CLASSES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

function Spinner() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  type = "button",
  disabled = false,
  to,
  className = "",
  children,
  ...rest
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-xl font-bold transition focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary} ${SIZE_CLASSES[size] || SIZE_CLASSES.md} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
