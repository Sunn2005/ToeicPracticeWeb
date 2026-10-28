import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/LanguageContext";
import { canUseConsole } from "../../auth/consolePermissions";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { approveSubmission, getSubmission, rejectSubmission } from "../../api/adminReviews";
import ReviewActions from "../../components/admin/ReviewActions";
import ReviewTimeline from "../../components/admin/ReviewTimeline";
import SubmissionPreview from "../../components/admin/SubmissionPreview";

const STATUS_BADGES = {
  PENDING_REVIEW: { label: "Chờ duyệt", className: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "Đã duyệt", className: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Từ chối", className: "bg-red-100 text-red-700" },
};

// Chuẩn hóa fieldErrors của backend thành mảng [{field, message}] để vẽ hộp đỏ.
// Backend trả fieldErrors dạng object { "parts[0].questions[5].correctAnswer": "không được trống" }
// (xem mục 9.3/9.4 và bảng mã lỗi trong docs/archive/API_ROLE_WORKFLOWS.md).
function normalizeFieldErrors(fieldErrors) {
  if (!fieldErrors) return [];
  if (Array.isArray(fieldErrors)) {
    return fieldErrors.map((item, index) =>
      typeof item === "string"
        ? { field: `Lỗi ${index + 1}`, message: item }
        : { field: item.field || item.path || `Lỗi ${index + 1}`, message: item.message || String(item) },
    );
  }
  return Object.entries(fieldErrors).flatMap(([field, value]) =>
    (Array.isArray(value) ? value : [value]).map((message) => ({ field, message: String(message) })),
  );
}

// Từ fieldErrors đoán Part nào bị lỗi để chấm đỏ ở danh sách Part (Figma frame 8).
// Ví dụ key "parts[2].questions[5].correctAnswer" → parts[2] → partNumber của part đó.
function extractErrorPartNumbers(parts, fieldErrors) {
  const numbers = new Set();
  normalizeFieldErrors(fieldErrors).forEach(({ field }) => {
    const match = /parts?\[(\d+)\]/i.exec(field);
    if (match) {
      const part = (parts || [])[Number(match[1])];
      if (part?.partNumber != null) numbers.add(part.partNumber);
    }
  });
  return numbers;
}

function formatDateTime(timestamp) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString("vi-VN");
}

// Hộp đỏ validation đúng Figma frame 8: liệt kê lỗi từng câu khi backend
// trả 400 vì cấu trúc đề không hợp lệ lúc duyệt.
function ValidationErrorBox({ fieldErrors, fallbackMessage }) {
  const items = normalizeFieldErrors(fieldErrors);
  return (
    <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
      <p className="font-bold text-red-800">Phát hiện lỗi nhập liệu</p>
      <p className="mt-1 text-sm text-red-600">
        Đề thi chưa đạt yêu cầu kiểm tra. Vui lòng xem chi tiết lỗi bên dưới.
      </p>
      {items.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-red-700">
          {items.map(({ field, message }, index) => (
            <li key={`${field}-${index}`}>
              <code className="rounded bg-red-100 px-1.5 py-0.5 text-xs">{field}</code>
              {" — "}{message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-red-700">{fallbackMessage}</p>
      )}
    </div>
  );
}

// Banner conflict đúng Figma frame 9: admin khác đã xử lý đề trước,
// trang chuyển sang chế độ chỉ đọc.
function ConflictBanner() {
  return (
    <div role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="font-bold text-amber-800">Đề thi đã được admin khác xử lý</p>
      <p className="mt-1 text-sm text-amber-700">
        Đề này không còn ở trạng thái chờ duyệt. Trang đang ở chế độ chỉ đọc,
        bạn không thể phê duyệt hoặc từ chối nữa.
      </p>
      <Link
        to="/console/reviews"
        className="mt-4 inline-flex rounded-xl bg-[#2188ee] px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-600"
      >
        Quay lại hàng chờ
      </Link>
    </div>
  );
}

function ApprovalInfoCard({ test }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-950">Thông tin phê duyệt</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Người duyệt</dt>
          <dd className="font-semibold text-slate-900">{test.reviewedBy || "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Thời gian duyệt</dt>
          <dd className="font-semibold text-slate-900">{formatDateTime(test.reviewedAt)}</dd>
        </div>
        {test.status === "REJECTED" && (
          <div>
            <dt className="text-slate-500">Lý do từ chối</dt>
            <dd className="mt-1 rounded-lg bg-red-50 p-3 font-medium text-red-700">
              {test.rejectionReason || "—"}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function TestReviewPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [actionError, setActionError] = useState(null);

  const loadTest = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setNotFound(false);
    try {
      const data = await getSubmission(testId);
      setTest(data);
    } catch (error) {
      // 404: đề không tồn tại hoặc không ở trạng thái duyệt được (mục 9.2 docs).
      if (error?.status === 404) {
        setNotFound(true);
      } else if (error?.status === 401) {
        setLoadError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      } else if (error?.status === 403) {
        setLoadError("Tài khoản của bạn không có quyền xem đề thi này.");
      } else {
        setLoadError(error?.message || "Không thể tải nội dung đề. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    // Tải chi tiết đề khi mở trang; state chỉ đổi sau khi request xong.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTest();
  }, [loadTest]);

  const handleActionError = useCallback(
    async (error) => {
      // 409: đề không còn PENDING_REVIEW (admin khác duyệt/từ chối trước).
      // Tải lại để hiển thị trạng thái mới nhất + chuyển sang chế độ chỉ đọc.
      if (error?.status === 409) {
        setConflict(true);
        setActionError(null);
        try {
          const data = await getSubmission(testId);
          setTest(data);
        } catch {
          // Giữ nguyên dữ liệu cũ nếu tải lại thất bại.
        }
        return;
      }
      if (error?.status === 400) {
        setActionError({
          kind: "validation",
          fieldErrors: error?.body?.fieldErrors,
          fallbackMessage: error?.message || "Cấu trúc đề thi không hợp lệ.",
        });
        return;
      }
      if (error?.status === 401) {
        setActionError({ kind: "message", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." });
        return;
      }
      if (error?.status === 403) {
        setActionError({ kind: "message", message: "Tài khoản của bạn không có quyền thực hiện thao tác này." });
        return;
      }
      setActionError({ kind: "message", message: error?.message || "Đã xảy ra lỗi. Vui lòng thử lại." });
    },
    [testId],
  );

  const handleApprove = async () => {
    setActionError(null);
    try {
      await approveSubmission(testId);
      navigate("/console/review-history", { replace: true });
    } catch (error) {
      await handleActionError(error);
    }
  };

  const handleReject = async (reason) => {
    setActionError(null);
    try {
      await rejectSubmission(testId, reason);
      navigate("/console/review-history", { replace: true });
    } catch (error) {
      await handleActionError(error);
    }
  };

  if (loading) {
    return <p className="py-20 text-center text-sm text-slate-500">Đang tải nội dung đề...</p>;
  }

  if (notFound) {
    return (
      <section className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-xl font-bold text-slate-900">Không tìm thấy đề thi</p>
        <p className="mt-2 text-sm text-slate-500">
          Đề thi không tồn tại hoặc không còn ở trạng thái có thể xem xét.
        </p>
        <Link
          to="/console/reviews"
          className="mt-6 inline-flex rounded-xl bg-[#2188ee] px-5 py-3 text-sm font-bold text-white hover:bg-blue-600"
        >
          Quay lại hàng chờ
        </Link>
      </section>
    );
  }

  if (loadError || !test) {
    return (
      <section className="mx-auto max-w-3xl py-16 text-center">
        <p role="alert" className="text-sm text-red-600">{loadError || "Không thể tải nội dung đề."}</p>
        <button
          type="button"
          onClick={loadTest}
          className="mt-6 rounded-xl border border-blue-400 px-5 py-3 text-sm font-bold text-[#2188ee] hover:bg-blue-50"
        >
          Thử lại
        </button>
      </section>
    );
  }

  const isPending = test.status === "PENDING_REVIEW" && !conflict;
  const badge = STATUS_BADGES[test.status] || { label: test.status || "—", className: "bg-slate-100 text-slate-600" };
  const errorPartNumbers =
    actionError?.kind === "validation"
      ? extractErrorPartNumbers(test.parts, actionError.fieldErrors)
      : new Set();

  return (
    <section className="mx-auto max-w-[1500px]">
      <Link to="/console/reviews" className="mb-5 inline-block text-sm font-bold text-[#2188ee] hover:text-blue-700">
        ← Quay lại hàng chờ
      </Link>

      {/* Thẻ tiêu đề: badge trạng thái + tên đề + nút duyệt (Figma frame 7) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${badge.className}`}>
                {badge.label}
              </span>
              {isPending && canUseConsole(profile, "reviews.edit") && test.createdBy !== profile?.uid && (
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                  Bản nhập
                </span>
              )}
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-950 sm:text-3xl">
              {test.title || "Chi tiết đề thi"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Mã đề: {testId} · Người tạo: {test.createdBy || "—"}
            </p>
          </div>
          <div className="rounded-xl bg-blue-50 px-5 py-3 text-center">
            <strong className="block text-2xl text-blue-700">{test.totalQuestions || 0}</strong>
            <span className="text-xs font-semibold text-blue-600">câu hỏi</span>
          </div>
        </div>

        {test.description && (
          <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            {test.description}
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            ["Loại", test.type === "PRACTICE" ? "Mini Test" : "Full Test"],
            ["Listening", `${test.listeningMinutes ?? 45} phút`],
            ["Reading", `${test.readingMinutes ?? 75} phút`],
            ["Số Part", test.parts?.length ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-1 font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        {isPending && canUseConsole(profile, "reviews.edit") && test.createdBy !== profile?.uid && (
          <div className="mt-6">
            <ReviewActions onApprove={handleApprove} onReject={handleReject} />
          </div>
        )}
      </div>

      {isPending && test.createdBy === profile?.uid && <p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{t("staffSelfReview")}</p>}
      {conflict && <ConflictBanner />}

      {actionError?.kind === "validation" && (
        <ValidationErrorBox
          fieldErrors={actionError.fieldErrors}
          fallbackMessage={actionError.fallbackMessage}
        />
      )}
      {actionError?.kind === "message" && (
        <p role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {actionError.message}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SubmissionPreview test={test} errorPartNumbers={errorPartNumbers} />
        <aside className="space-y-6">
          {(test.status === "APPROVED" || test.status === "REJECTED") && (
            <ApprovalInfoCard test={test} />
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-slate-950">Dòng thời gian</h2>
            <ReviewTimeline test={test} />
          </div>
        </aside>
      </div>
    </section>
  );
}

export default TestReviewPage;
