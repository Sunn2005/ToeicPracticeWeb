import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createEmployeeTest } from "../../api/employeeTests";

function CreateTestPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", description: "", type: "FULL_TEST", listeningMinutes: 45, readingMinutes: 75, totalMinutes: 120, totalQuestions: 200 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createEmployeeTest({ ...form, listeningMinutes: Number(form.listeningMinutes), readingMinutes: Number(form.readingMinutes), totalMinutes: Number(form.totalMinutes), totalQuestions: Number(form.totalQuestions) });
      navigate("/console/tests", { replace: true });
    } catch (saveError) {
      setError(saveError.message || "Không thể tạo đề thi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Tạo đề mới</h1>
      <p className="mt-2 text-sm text-slate-500">Tạo thông tin cơ bản cho bản nháp đề thi.</p>
      <form onSubmit={submit} className="mt-7 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div><label htmlFor="title" className="mb-2 block text-sm font-bold text-slate-700">Tên đề thi</label><input id="title" name="title" required value={form.title} onChange={update} className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Ví dụ: TOEIC Practice Test 4" /></div>
        <div><label htmlFor="description" className="mb-2 block text-sm font-bold text-slate-700">Mô tả</label><textarea id="description" name="description" rows="4" value={form.description} onChange={update} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Mô tả ngắn về đề thi" /></div>
        <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="type" className="mb-2 block text-sm font-bold text-slate-700">Loại đề</label><select id="type" name="type" value={form.type} onChange={update} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4"><option value="FULL_TEST">Full Test</option><option value="PRACTICE">Mini Test</option></select></div><div><label htmlFor="totalQuestions" className="mb-2 block text-sm font-bold text-slate-700">Số câu hỏi</label><input id="totalQuestions" name="totalQuestions" type="number" min="1" value={form.totalQuestions} onChange={update} className="h-12 w-full rounded-xl border border-slate-200 px-4" /></div></div>
        <div className="grid gap-5 sm:grid-cols-3">{[["listeningMinutes", "Listening"], ["readingMinutes", "Reading"], ["totalMinutes", "Tổng thời gian"]].map(([name, label]) => <div key={name}><label htmlFor={name} className="mb-2 block text-sm font-bold text-slate-700">{label} (phút)</label><input id={name} name={name} type="number" min="1" value={form[name]} onChange={update} className="h-12 w-full rounded-xl border border-slate-200 px-4" /></div>)}</div>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-3"><button type="button" onClick={() => navigate(-1)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600">Hủy</button><button type="submit" disabled={saving} className="rounded-xl bg-[#2188ee] px-5 py-3 text-sm font-bold text-white disabled:bg-blue-300">{saving ? "Đang lưu..." : "Tạo bản nháp"}</button></div>
      </form>
    </section>
  );
}

export default CreateTestPage;
