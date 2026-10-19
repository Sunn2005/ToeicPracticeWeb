function formatDateTime(timestamp) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString("vi-VN");
}

// Dòng thời gian trạng thái của một đề: Tạo → Nộp duyệt → Xem xét → Duyệt/Từ chối.
// Đúng yêu cầu Figma: timeline 4 mốc trên trang Review History Detail (frame 6)
// và trang Test Review Detail (frame 7).
//
// Vì sao tách component này ra khỏi các trang:
// - Cả 3 trang (chi tiết chờ duyệt, chi tiết lịch sử, và sau này có thể thêm)
//   đều cần hiển thị cùng một dòng thời gian — tách ra để dùng lại,
//   tránh mỗi trang tự vẽ một kiểu khác nhau.
//
// Cách dùng: <ReviewTimeline test={test} />
// - test: object Test đầy đủ từ getSubmission(), cần các field
//   createdAt, submittedAt, reviewedAt, reviewedBy, rejectionReason, status.
function ReviewTimeline({ test }) {
  if (!test) return null;

  const status = test.status;
  const isReviewed = status === "APPROVED" || status === "REJECTED";

  // 4 mốc cố định của vòng đời đề thi (khớp business invariant của nhóm:
  // DRAFT → PENDING_REVIEW → APPROVED, PENDING_REVIEW → REJECTED → DRAFT).
  const steps = [
    {
      label: "Tạo đề",
      description: "Nhân viên tạo bản nhập đề thi.",
      timestamp: test.createdAt,
      state: "done",
    },
    {
      label: "Nộp duyệt",
      description: "Đề thi được gửi lên hàng chờ của admin.",
      timestamp: test.submittedAt,
      state: test.submittedAt ? "done" : "upcoming",
    },
    {
      label: "Xem xét",
      description: status === "PENDING_REVIEW" ? "Admin đang xem xét nội dung đề." : "Admin đã xem xét nội dung đề.",
      timestamp: status === "PENDING_REVIEW" ? null : test.reviewedAt,
      state: status === "PENDING_REVIEW" ? "current" : "done",
    },
    {
      label: status === "REJECTED" ? "Từ chối" : "Phê duyệt",
      description:
        status === "APPROVED"
          ? `Được duyệt bởi ${test.reviewedBy || "admin"}.`
          : status === "REJECTED"
            ? test.rejectionReason || "Đề thi bị từ chối."
            : "Chờ quyết định phê duyệt hoặc từ chối.",
      timestamp: isReviewed ? test.reviewedAt : null,
      state: isReviewed ? (status === "APPROVED" ? "done" : "rejected") : "upcoming",
    },
  ];

  const dotClassName = {
    done: "bg-emerald-500 border-emerald-500",
    current: "bg-[#2188ee] border-[#2188ee] ring-4 ring-blue-100",
    rejected: "bg-red-500 border-red-500",
    upcoming: "bg-white border-slate-300",
  };

  return (
    <ol className="relative space-y-6 border-l-2 border-slate-200 pl-0" aria-label="Dòng thời gian phê duyệt">
      {steps.map((step) => (
        <li key={step.label} className="relative pl-10">
          <span
            aria-hidden="true"
            className={`absolute -left-[9px] top-0.5 h-4 w-4 rounded-full border-2 ${dotClassName[step.state]}`}
          />
          <p className="text-sm font-bold text-slate-900">{step.label}</p>
          <p className="mt-0.5 text-sm text-slate-500">{step.description}</p>
          {step.timestamp && (
            <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(step.timestamp)}</p>
          )}
          {step.state === "current" && (
            <span className="mt-1 inline-flex rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
              Đang diễn ra
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export default ReviewTimeline;
