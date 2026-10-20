export default function EmptyState({ title, description, action, icon, className = "" }) {
  return (
    <div
      className={`mx-auto flex w-full max-w-xl flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center ${className}`}
    >
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-sky-50 text-[#2188ee]" aria-hidden="true">
        {icon || (
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7l2-3h12l2 3M4 7v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7M4 7h16M9 12h6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
      {description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
