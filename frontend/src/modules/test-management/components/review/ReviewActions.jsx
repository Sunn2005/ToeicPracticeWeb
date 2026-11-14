import { useCallback, useEffect, useRef, useState } from "react";

const MAX_REASON_LENGTH = 500;

// Khung modal dùng chung cho cả 2 hộp thoại Duyệt/Từ chối (đúng frame 10-11 Figma):
// overlay mờ, đóng bằng phím Escape hoặc click ra ngoài, role="dialog" cho
// trình đọc màn hình. Tách riêng để ApproveModal và RejectModal dùng lại,
// tránh lặp code xử lý Escape/overlay.
// (Member 1 chưa làm ui/Modal dùng chung nên tự dựng trong scope admin/**.)
function Modal({ labelledBy, onClose, children }) {
  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={handleOverlayClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8"
      >
        {children}
      </div>
    </div>
  );
}

function ApproveModal({ busy, onClose, onConfirm }) {
  return (
    <Modal labelledBy="approve-modal-title" onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-emerald-600">
            <path d="m5 13 4 4L19 7" />
          </svg>
        </span>
        <h2 id="approve-modal-title" className="mt-4 text-xl font-bold text-slate-950">
          Phê duyệt đề thi
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Đề thi sẽ được phát hành và hiển thị trong danh mục công khai.
          Bạn có chắc chắn muốn phê duyệt?
        </p>
        <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "Đang xử lý..." : "Đồng ý phê duyệt"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RejectModal({ busy, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const textareaRef = useRef(null);
  const trimmed = reason.trim();

  // Tự focus vào ô nhập lý do khi modal mở, admin gõ ngay không cần click.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <Modal labelledBy="reject-modal-title" onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-red-600">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </span>
        <h2 id="reject-modal-title" className="mt-4 text-xl font-bold text-slate-950">
          Từ chối đề thi
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Đề thi sẽ được trả lại cho nhân viên chỉnh sửa. Vui lòng nhập lý do từ chối.
        </p>
      </div>
      <div className="mt-5">
        <label htmlFor="reject-reason" className="block text-sm font-bold text-slate-700">
          Lý do từ chối <span className="text-red-600">*</span>
        </label>
        <textarea
          id="reject-reason"
          ref={textareaRef}
          rows="4"
          value={reason}
          maxLength={MAX_REASON_LENGTH}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Nhập lý do từ chối đề thi..."
          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100"
        />
        <p className="mt-1 text-right text-xs text-slate-400" aria-live="polite">
          {reason.length}/{MAX_REASON_LENGTH}
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="flex-1 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={() => onConfirm(trimmed)}
          disabled={busy || trimmed.length === 0}
          className="flex-1 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Đang xử lý..." : "Xác nhận từ chối"}
        </button>
      </div>
    </Modal>
  );
}

// Nút "Từ chối" / "Phê duyệt" + 2 modal xác nhận đúng Figma (frame 10-11).
// Vì sao tách component này ra khỏi TestReviewPage:
// - Trang chi tiết trước đây dùng window.confirm nhìn rất "tạm" và không
//   nhập được lý do từ chối; modal là yêu cầu bắt buộc của Figma.
// - Gom logic modal + chặn double-submit (busy) vào một chỗ, các trang khác
//   (ví dụ Review History Detail) sau này dùng lại được mà không copy code.
//
// Cách dùng: <ReviewActions onApprove={...} onReject={...} />
// - onApprove: async () => void — cha tự gọi API approve + xử lý lỗi.
// - onReject: async (reason: string) => void — cha tự gọi API reject + xử lý lỗi.
// - disabled: khóa cả 2 nút (ví dụ khi trang ở chế độ chỉ đọc do conflict).
function ReviewActions({ onApprove, onReject, disabled = false }) {
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const closeModal = useCallback(() => {
    if (!busy) setModal(null);
  }, [busy]);

  const handleApprove = async () => {
    setBusy(true);
    try {
      await onApprove();
    } finally {
      setBusy(false);
      setModal(null);
    }
  };

  const handleReject = async (reason) => {
    setBusy(true);
    try {
      await onReject(reason);
    } finally {
      setBusy(false);
      setModal(null);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => setModal("reject")}
          disabled={disabled || busy}
          className="rounded-xl border border-red-300 px-5 py-3 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Từ chối
        </button>
        <button
          type="button"
          onClick={() => setModal("approve")}
          disabled={disabled || busy}
          className="rounded-xl bg-[#2188ee] px-5 py-3 text-sm font-bold text-white hover:bg-blue-600 disabled:bg-blue-300"
        >
          Phê duyệt
        </button>
      </div>
      {modal === "approve" && (
        <ApproveModal busy={busy} onClose={closeModal} onConfirm={handleApprove} />
      )}
      {modal === "reject" && (
        <RejectModal busy={busy} onClose={closeModal} onConfirm={handleReject} />
      )}
    </>
  );
}

export default ReviewActions;
