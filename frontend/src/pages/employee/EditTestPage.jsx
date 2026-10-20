import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TestEditorWizard from "../../components/test-editor/TestEditorWizard";
import { getEmployeeTest } from "../../api/employeeTests";

function EditTestPage() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!testId) {
      setError("Không tìm thấy mã đề thi.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    getEmployeeTest(testId)
      .then((data) => {
        if (!data) throw new Error("Không tìm thấy dữ liệu đề thi.");
        setTest(data);
      })
      .catch((err) => {
        setError(err?.message || "Không thể tải thông tin đề thi.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [testId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl py-24 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent" />
        <p className="mt-4 text-sm font-semibold text-slate-600">
          Đang tải dữ liệu đề thi {testId}...
        </p>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <span className="text-4xl">⚠️</span>
          <h2 className="mt-3 text-lg font-bold text-slate-900">
            Không thể tải đề thi
          </h2>
          <p className="mt-2 text-sm text-red-600">{error || "Đề thi không tồn tại."}</p>
          <button
            type="button"
            onClick={() => navigate("/console/tests")}
            className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Quay lại danh sách đề thi
          </button>
        </div>
      </div>
    );
  }

  return <TestEditorWizard key={test.testId || testId} initialTest={test} mode="edit" />;
}

export default EditTestPage;
