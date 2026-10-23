import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { normalizeEditorTest, validateEmployeeTest } from "../../components/test-editor/testEditorState";
import TestPreview from "../../components/test-editor/TestPreview";
import { getEmployeeTest, submitEmployeeTest } from "../../api/employeeTests";

function TestPreviewPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(Boolean(testId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Reset when navigating to a different test (render-phase adjustment).
  const [prevTestId, setPrevTestId] = useState(testId);
  if (testId !== prevTestId) {
    setPrevTestId(testId);
    setTest(null);
    setLoading(Boolean(testId));
    setError("");
  }

  useEffect(() => {
    if (!testId) return;

    let cancelled = false;
    getEmployeeTest(testId)
      .then((data) => {
        if (!cancelled) setTest(normalizeEditorTest(data));
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Không thể tải đề thi.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [testId]);

  const displayError = testId ? error : "Không tìm thấy mã đề.";

  const editable = test && ["DRAFT", "REJECTED"].includes(test.status);
  const validation = validateEmployeeTest(test);
  const handleSubmit = async () => {
    if (submitting || !editable) return;
    if (validation.errors.length) {
      setError(t("employeeEditorCannotSubmit"));
      return;
    }
    if (!window.confirm("Bạn muốn gửi đề thi này để Admin phê duyệt?")) return;
    setSubmitting(true);
    setError("");
    try {
      await submitEmployeeTest(testId);
      alert("Đã gửi phê duyệt thành công!");
      navigate("/console/tests", { replace: true });
    } catch (err) {
      setError(err?.message || "Không thể gửi phê duyệt.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl py-24 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent" />
        <p className="mt-3 text-sm text-slate-500">Đang chuẩn bị bản xem trước...</p>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="rounded-2xl border border-red-200 bg-white p-8">
          <p className="text-sm text-red-600">{displayError || "Không tìm thấy đề thi."}</p>
          <button
            type="button"
            onClick={() => navigate("/console/tests")}
            className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-semibold text-slate-500">
            Xem trước đề thi · Mã đề: {testId}
          </span>
          <h1 className="text-2xl font-bold text-slate-900">{test.title}</h1>
        </div>

        <div className="flex items-center gap-3">
          {editable && <Link
            to={`/console/tests/${encodeURIComponent(testId)}/edit`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            ✏️ Chỉnh sửa đề
          </Link>}
          {editable && <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition disabled:opacity-50"
          >
            {submitting ? "Đang gửi..." : "Gửi phê duyệt ✓"}
          </button>}
        </div>
      </div>

      <TestPreview test={test} />
    </div>
  );
}

export default TestPreviewPage;
