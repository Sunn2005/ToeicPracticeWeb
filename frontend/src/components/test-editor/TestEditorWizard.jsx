import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TestMetadataForm from "./TestMetadataForm";
import PartEditor from "./PartEditor";
import TestValidationSummary from "./TestValidationSummary";
import TestPreview from "./TestPreview";
import {
  createEmployeeTest,
  updateEmployeeTest,
  submitEmployeeTest,
} from "../../api/employeeTests";
import { generateMockToeicTest } from "../../utils/mockToeicTest";

import { useLanguage } from "../../i18n/LanguageContext";
import { normalizeEditorTest, saveEmployeeDraft, saveAndSubmitEmployeeTest, validateEmployeeTest } from "./testEditorState";

const STEPS = [
  { id: 1, title: "Thông tin đề" },
  { id: 2, title: "Phần Nghe (1–4)" },
  { id: 3, title: "Phần Đọc (5–7)" },
  { id: 4, title: "Kiểm tra dữ liệu" },
  { id: 5, title: "Xem trước" },
  { id: 6, title: "Hoàn tất & Gửi duyệt" },
];

function createDefaultParts() {
  return [
    { partNumber: 1, name: "Phần 1: Hình ảnh", questions: [] },
    { partNumber: 2, name: "Phần 2: Hỏi - Đáp", questions: [] },
    { partNumber: 3, name: "Phần 3: Hội thoại", groups: [] },
    { partNumber: 4, name: "Phần 4: Bài nói ngắn", groups: [] },
    { partNumber: 5, name: "Phần 5: Điền câu", questions: [] },
    { partNumber: 6, name: "Phần 6: Điền đoạn văn", passages: [] },
    { partNumber: 7, name: "Phần 7: Đọc hiểu", passageGroups: [] },
  ];
}

/**
 * TestEditorWizard
 *
 * @param {object} initialTest - initial test data (empty or fetched)
 * @param {"create"|"edit"} mode - creation or editing mode
 */
export default function TestEditorWizard({ initialTest, mode = "create" }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const mutationRef = useRef(false);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [test, setTest] = useState(() => {
    if (initialTest) {
      return {
        ...normalizeEditorTest(initialTest),
        parts: initialTest.parts?.length ? normalizeEditorTest(initialTest).parts : createDefaultParts(),
      };
    }
    return {
      title: "",
      description: "",
      type: "FULL_TEST",
      difficulty: "intermediate",
      totalQuestions: 200,
      listeningMinutes: 45,
      readingMinutes: 75,
      totalMinutes: 120,
      parts: createDefaultParts(),
    };
  });

  const updateMetadata = (updatedFields) => {
    setTest((current) => ({ ...current, ...updatedFields }));
  };

  const updateParts = (newParts) => {
    setTest((current) => ({ ...current, parts: newParts }));
  };

  // Quick-load a complete 200-question sample test for validation/preview.
  // TestValidationSummary renders its "Nạp đề mẫu" buttons only when this
  // callback is provided, so the wizard must pass it explicitly.
  const handleLoadMockTest = () => {
    if (
      !window.confirm(
        "Nạp đề mẫu 200 câu sẽ thay thế toàn bộ dữ liệu đề hiện tại. Bạn có chắc chắn?",
      )
    ) {
      return;
    }
    setTest((current) => ({
      ...generateMockToeicTest(),
      // Keep the existing id in edit mode so saving updates the same test.
      ...(current.testId ? { testId: current.testId } : {}),
    }));
    setError("");
    setSuccessMsg("Đã nạp đề mẫu 200 câu. Hãy kiểm tra lại dữ liệu trước khi lưu.");
  };

  // Compute question counts for summary
  const questionSummary = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    (test.parts || []).forEach((p) => {
      const pNum = p.partNumber;
      if (p.questions) counts[pNum] = p.questions.length;
      else if (p.groups) {
        counts[pNum] = p.groups.reduce((acc, g) => acc + (g.questions?.length || 0), 0);
      } else if (p.passages) {
        counts[pNum] = p.passages.reduce((acc, pass) => acc + (pass.questions?.length || 0), 0);
      } else if (p.passageGroups) {
        counts[pNum] = p.passageGroups.reduce((acc, g) => acc + (g.questions?.length || 0), 0);
      }
    });

    const totalListening = counts[1] + counts[2] + counts[3] + counts[4];
    const totalReading = counts[5] + counts[6] + counts[7];
    const totalAll = totalListening + totalReading;

    return { counts, totalListening, totalReading, totalAll };
  }, [test.parts]);

  const busy = saving || submitting;
  const editable = !test.status || ["DRAFT", "REJECTED"].includes(test.status);
  const validation = useMemo(() => validateEmployeeTest(test), [test]);
  const [focus, setFocus] = useState({});
  const goToIssue = (targetStep, partNumber, questionNumber) => {
    setFocus({ partNumber, questionNumber });
    setStep(targetStep);
  };
  const requestError = (err) => {
    if (err?.status === 401) return t("employeeEditorAuthError");
    if (err?.status === 403) return t("employeeEditorAccessError");
    if (err?.status === 409) return t("employeeEditorConflictError");
    if (["employeeEditorCannotSubmit", "employeeEditorMissingSavedId"].includes(err?.message)) return t(err.message);
    return t("employeeEditorRequestError");
  };
  const api = {
    create: createEmployeeTest,
    update: updateEmployeeTest,
    submit: submitEmployeeTest,
    onSaved: (saved) => setTest((current) => ({ ...current, ...normalizeEditorTest(saved) })),
  };

  const handleSaveDraft = async () => {
    if (mutationRef.current || !editable) return;
    mutationRef.current = true;
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const saved = await saveEmployeeDraft(test, api);
      if (!saved?.testId) throw new Error("employeeEditorMissingSavedId");
      api.onSaved(saved);
      setSuccessMsg("Đã lưu bản nháp thành công!");
    } catch (err) {
      setError(requestError(err));
    } finally {
      mutationRef.current = false;
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (mutationRef.current || !editable) return;
    if (validation.errors.length) {
      setError(t("employeeEditorCannotSubmit"));
      setStep(4);
      return;
    }
    if (!window.confirm("Bạn có chắc chắn muốn gửi đề thi này để Quản trị viên duyệt?")) return;
    mutationRef.current = true;
    setSubmitting(true);
    setError("");
    setSuccessMsg("");
    try {
      await saveAndSubmitEmployeeTest(test, api);
      alert("Đã gửi đề thi lên hàng chờ duyệt thành công!");
      navigate("/console/tests", { replace: true });
    } catch (err) {
      setError(requestError(err));
    } finally {
      mutationRef.current = false;
      setSubmitting(false);
    }
  };

  const handleNextStep = () => {
    if (step === 1 && !test.title?.trim()) {
      setError("Vui lòng nhập tên đề thi trước khi tiếp tục.");
      return;
    }
    setError("");
    setStep((prev) => Math.min(6, prev + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrevStep = () => {
    setError("");
    setStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto max-w-6xl pb-28">
      {/* Top Breadcrumb & Status */}
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <span className="text-xs font-semibold text-slate-500">
            Quản lý đề thi / {mode === "edit" ? "Chỉnh sửa đề" : "Tạo đề mới"}
          </span>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            {test.title || "Tạo Đề Thi Mới"}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/console/tests")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            ← Danh sách đề
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={busy || !editable}
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "💾 Lưu nháp"}
          </button>
        </div>
      </div>

      {/* Stepper Header (Matching Stitch Design) */}
      <div className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="relative flex items-center justify-between">
          {/* Background Connecting Line */}
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 -z-0" />
          {/* Active Progress Fill */}
          <div
            className="absolute left-6 top-1/2 -translate-y-1/2 h-0.5 bg-blue-600 -z-0 transition-all duration-300"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 92}%` }}
          />

          {STEPS.map((s) => {
            const isCompleted = s.id < step;
            const isCurrent = s.id === step;

            return (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => setStep(s.id)}
                className="group relative z-10 flex flex-col items-center bg-white px-2 focus:outline-none cursor-pointer"
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${isCompleted
                    ? "bg-blue-600 text-white shadow-sm"
                    : isCurrent
                      ? "border-2 border-blue-600 bg-white text-blue-600 ring-4 ring-blue-100 shadow-sm"
                      : "border-2 border-slate-200 bg-white text-slate-400 group-hover:border-slate-300"
                    }`}
                >
                  {isCompleted ? "✓" : s.id}
                </div>
                <span
                  className={`mt-2 text-[11px] font-bold transition-colors ${isCurrent
                    ? "text-blue-600 font-extrabold"
                    : isCompleted
                      ? "text-slate-700"
                      : "text-slate-400"
                    }`}
                >
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-500 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center justify-between"
        >
          <span>{successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg("")}
            className="text-emerald-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {!editable && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{t("employeeEditorNotEditable")}</p>}
      {submitting && <p role="status" className="mb-4 text-sm text-blue-700">{t("employeeEditorSaving")}</p>}
      {step === 6 && validation.errors.length > 0 && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {t("employeeEditorCannotSubmit")}
          <button type="button" className="ml-3 underline" onClick={() => setStep(4)}>← {STEPS[3].title}</button>
        </p>
      )}
      {/* Step Content */}
      <fieldset disabled={busy || !editable} className="min-w-0 min-h-[460px]">
        {step === 1 && (
          <TestMetadataForm form={test} onChange={updateMetadata} />
        )}

        {step === 2 && (
          <PartEditor
            section="listening"
            parts={test.parts}
            onUpdateParts={updateParts}
            initialPartNumber={focus.partNumber}
            initialQuestionNumber={focus.questionNumber}
          />
        )}

        {step === 3 && (
          <PartEditor
            section="reading"
            parts={test.parts}
            onUpdateParts={updateParts}
            initialPartNumber={focus.partNumber}
            initialQuestionNumber={focus.questionNumber}
          />
        )}

        {step === 4 && (
          <TestValidationSummary
            test={test}
            onGoToStep={goToIssue}
            onLoadMockTest={handleLoadMockTest}
          />
        )}

        {step === 5 && <TestPreview test={test} />}

        {step === 6 && (
          <div className="space-y-8">
            <div className="text-center sm:text-left">
              <h2 className="text-2xl font-bold text-slate-900">
                Hoàn tất & Gửi phê duyệt
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Xem lại bản tóm tắt cấu hình đề thi của bạn trước khi gửi phê duyệt.
              </p>
            </div>

            {/* Summary Bento Grid (from Stitch Step 6) */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Card 1: Meta info banner */}
              <div className="col-span-1 md:col-span-2 lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {test.title || "Chưa đặt tên đề thi"}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>⏱ Thời lượng: {test.totalMinutes || 120} phút</span>
                    <span>•</span>
                    <span>📊 Tổng câu hỏi: {questionSummary.totalAll} câu</span>
                    <span>•</span>
                    <span>🎯 Độ khó: {test.difficulty || "Tiêu chuẩn"}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {test.type === "PRACTICE" ? "Mini Test" : "Full Test Chuẩn"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    Bản nháp
                  </span>
                </div>
              </div>

              {/* Card 2: Listening Summary */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600">
                    🎧
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Phần Nghe</h4>
                    <p className="text-xs text-slate-500">{test.listeningMinutes || 45} phút</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs divide-y divide-slate-100">
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600">Part 1: Hình ảnh</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {questionSummary.counts[1]} / 6
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600">Part 2: Hỏi - Đáp</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {questionSummary.counts[2]} / 25
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600">Part 3: Hội thoại</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {questionSummary.counts[3]} / 39
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600">Part 4: Bài nói ngắn</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {questionSummary.counts[4]} / 30
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 font-bold text-blue-700 text-sm">
                    <span>Tổng Nghe</span>
                    <span className="font-mono">{questionSummary.totalListening} câu</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Reading Summary */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-xl text-amber-600">
                    📖
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Phần Đọc</h4>
                    <p className="text-xs text-slate-500">{test.readingMinutes || 75} phút</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs divide-y divide-slate-100">
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600">Part 5: Điền câu</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {questionSummary.counts[5]} / 30
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600">Part 6: Điền đoạn văn</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {questionSummary.counts[6]} / 16
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600">Part 7: Đọc hiểu</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {questionSummary.counts[7]} / 54
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 font-bold text-amber-700 text-sm">
                    <span>Tổng Đọc</span>
                    <span className="font-mono">{questionSummary.totalReading} câu</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Action / Submission Callout */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">Tổng kết đề thi</h4>
                  <div className="mt-4 rounded-xl bg-slate-50 p-6 text-center border border-slate-100">
                    <span className="text-3xl font-extrabold text-blue-600 font-mono">
                      {questionSummary.totalAll}
                    </span>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Tổng số câu hỏi đã tạo
                    </p>
                  </div>
                  <p className="mt-4 text-xs text-slate-500 text-center leading-relaxed">
                    Sau khi nhấn "Gửi phê duyệt", đề thi sẽ chuyển sang trạng thái <strong>Chờ duyệt (PENDING_REVIEW)</strong> để Admin thẩm định.
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={busy || !editable}
                    className="w-full rounded-xl border border-blue-300 bg-white py-3 text-sm font-bold text-blue-600 hover:bg-blue-50 transition shadow-xs"
                  >
                    {saving ? "Đang lưu..." : "💾 Lưu bản nháp"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitForReview}
                    disabled={busy || !editable || validation.errors.length > 0}
                    className="w-full rounded-xl bg-[#2188ee] py-3 text-sm font-bold text-white hover:bg-blue-600 transition shadow-md shadow-blue-200 disabled:opacity-50"
                  >
                    {submitting ? "Đang gửi..." : "🚀 Gửi phê duyệt ngay"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </fieldset>

      {/* Floating Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-md lg:left-70">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <button
            type="button"
            onClick={handlePrevStep}
            disabled={step === 1}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
          >
            ← Quay lại
          </button>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">
              Bước {step} / {STEPS.length}
            </span>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={busy || !editable}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              {saving ? "Đang lưu..." : "Lưu nháp"}
            </button>
            {step < 6 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="rounded-xl bg-[#2188ee] px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-600 shadow-md shadow-blue-200 transition"
              >
                Tiếp theo →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitForReview}
                disabled={busy || !editable || validation.errors.length > 0}
                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 shadow-md shadow-emerald-200 transition"
              >
                {submitting ? "Đang xử lý..." : "Gửi duyệt ✓"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
