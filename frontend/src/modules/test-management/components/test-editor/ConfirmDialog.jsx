import StaffDialog from "../../../staff-management/components/StaffDialog";

/**
 * ConfirmDialog — shared confirmation for destructive or state-changing
 * actions in the employee test editor, replacing window.confirm/alert so
 * the console keeps one consistent dialog style (StaffDialog).
 *
 * @param {string} title
 * @param {string} message
 * @param {string} [confirmLabel]
 * @param {string} [cancelLabel]
 * @param {boolean} [danger] - red confirm button for destructive actions
 * @param {boolean} [busy]
 * @param {function()} onConfirm
 * @param {function()} onClose
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}) {
  return (
    <StaffDialog title={title} onClose={onClose} busy={busy}>
      <div className="space-y-5 p-6">
        <p className="text-sm leading-6 text-slate-600">{message}</p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-11 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`min-h-11 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-[#2188ee] hover:bg-blue-600"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </StaffDialog>
  );
}
