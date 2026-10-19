import { useCallback, useEffect, useState } from "react";
import { getPendingSubmissions } from "../../api/adminReviews";
import SubmissionTable from "../../components/admin/SubmissionTable";

// Chuyển lỗi tải queue thành câu thân thiện, căn theo HTTP status + code
// (đúng quy ước nhóm: không so khớp message tiếng Việt của backend).
function getQueueErrorMessage(error) {
  if (error?.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (error?.status === 403) return "Tài khoản của bạn không có quyền truy cập trang này.";
  return error?.message || "Không thể tải hàng chờ duyệt. Vui lòng thử lại.";
}

function ReviewQueuePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getPendingSubmissions();
      setItems(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(getQueueErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Tải queue khi trang mở lần đầu; state chỉ đổi sau khi request xong.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadQueue();
  }, [loadQueue]);

  return (
    <section className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Yêu cầu chờ duyệt</h1>
      <p className="mt-2 text-sm text-slate-500">Kiểm tra nội dung trước khi phát hành đề thi.</p>

      {error && (
        <div role="alert" className="mt-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button type="button" onClick={loadQueue} className="font-bold underline underline-offset-4">
            Thử lại
          </button>
        </div>
      )}

      <div className="mt-7">
        <SubmissionTable items={items} loading={loading} />
      </div>
    </section>
  );
}

export default ReviewQueuePage;
