import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { approveSubmission, getSubmission, rejectSubmission } from "../../api/adminReviews";

function TestReviewPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSubmission(testId).then(setTest).catch((loadError) => setError(loadError.message)).finally(() => setLoading(false));
  }, [testId]);

  const approve = async () => {
    if (!window.confirm("Duyệt và phát hành đề thi này?")) return;
    setSaving(true); setError("");
    try { await approveSubmission(testId); navigate("/console/review-history", { replace: true }); } catch (saveError) { setError(saveError.message); setSaving(false); }
  };

  const reject = async () => {
    if (!reason.trim()) { setError("Vui lòng nhập lý do từ chối."); return; }
    setSaving(true); setError("");
    try { await rejectSubmission(testId, reason.trim()); navigate("/console/review-history", { replace: true }); } catch (saveError) { setError(saveError.message); setSaving(false); }
  };

  if (loading) return <p className="py-20 text-center text-sm text-slate-500">Đang tải nội dung đề...</p>;

  return (
    <section className="mx-auto max-w-5xl">
      <button type="button" onClick={() => navigate(-1)} className="mb-5 text-sm font-bold text-blue-600">← Quay lại hàng chờ</button>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">Chờ duyệt</span><h1 className="mt-4 text-2xl font-bold text-slate-950 sm:text-3xl">{test?.title || "Chi tiết đề thi"}</h1><p className="mt-2 text-sm text-slate-500">Mã đề: {testId} · Người tạo: {test?.createdBy || "—"}</p></div><div className="rounded-xl bg-blue-50 px-5 py-3 text-center"><strong className="block text-2xl text-blue-700">{test?.totalQuestions || 0}</strong><span className="text-xs font-semibold text-blue-600">câu hỏi</span></div></div>
        <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{test?.description || "Đề thi không có mô tả."}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">{[["Loại", test?.type || "FULL_TEST"], ["Listening", `${test?.listeningMinutes || 45} phút`], ["Reading", `${test?.readingMinutes || 75} phút`], ["Số Part", test?.parts?.length || 0]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div>)}</div>
      </div>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><label htmlFor="reject-reason" className="block text-sm font-bold text-slate-700">Lý do từ chối</label><textarea id="reject-reason" rows="4" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Chỉ cần nhập khi trả đề cho nhân viên chỉnh sửa" />{error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}<div className="mt-5 flex flex-col justify-end gap-3 sm:flex-row"><button type="button" onClick={reject} disabled={saving} className="rounded-xl border border-red-300 px-5 py-3 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">Từ chối đề</button><button type="button" onClick={approve} disabled={saving} className="rounded-xl bg-[#2188ee] px-5 py-3 text-sm font-bold text-white hover:bg-blue-600 disabled:bg-blue-300">{saving ? "Đang xử lý..." : "Duyệt và phát hành"}</button></div></div>
    </section>
  );
}

export default TestReviewPage;
