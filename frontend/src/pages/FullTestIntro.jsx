import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, apiFetch, publicApiFetch } from "../api/client";

function FullTestIntro() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [currentAttempt, setCurrentAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      publicApiFetch(`/api/tests/${testId}`),
      apiFetch(`/api/attempts/current?testId=${encodeURIComponent(testId)}`).catch(
        (requestError) => {
          if (requestError instanceof ApiError && requestError.status === 404) {
            return null;
          }
          throw requestError;
        },
      ),
    ])
      .then(([testData, attemptData]) => {
        if (!active) return;
        setTest(testData);
        setCurrentAttempt(attemptData);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [testId]);

  const startTest = async () => {
    setStarting(true);
    setError("");
    try {
      // forceRefresh=true bảo đảm đây là Firebase ID token mới, không phải
      // Google OAuth access token.
      const attempt = await apiFetch(`/api/tests/${testId}/attempts`, {
        method: "POST",
        forceRefresh: true,
      });
      navigate(`/full-test/${attempt.id}/exam`);
    } catch (requestError) {
      setError(requestError.message);
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sky-700">
        Đang tải thông tin đề thi...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-sky-50 to-cyan-100 text-slate-900">
      <header className="border-b border-white/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-3 font-bold text-slate-950"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-sm text-white">
              TP
            </span>
            TOEIC Practice
          </button>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Về Dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-4xl border border-white bg-white/90 shadow-2xl shadow-sky-100/80">
          <div className="bg-linear-to-r from-sky-500 to-cyan-500 px-6 py-8 text-white sm:px-10 sm:py-10">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-100">
              Full Test · Test 1
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
              {test?.title || "TOEIC Listening & Reading – Test 1"}
            </h1>
            <p className="mt-4 max-w-3xl leading-7 text-sky-50">
              Mô phỏng bài thi TOEIC hoàn chỉnh với 200 câu, đồng hồ riêng cho
              Listening và Reading, tự động lưu đáp án và khôi phục khi tải lại trang.
            </p>
          </div>

          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_340px]">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Cấu trúc bài thi</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
                    Listening
                  </p>
                  <p className="mt-2 text-2xl font-bold">100 câu · 45 phút</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Part 1–4. Làm tuần tự, không quay lại câu trước. Audio phát theo câu hoặc nhóm câu.
                  </p>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-violet-600">
                    Reading
                  </p>
                  <p className="mt-2 text-2xl font-bold">100 câu · 75 phút</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Part 5–7. Tự do chuyển câu, có bảng câu hỏi và nút tìm câu chưa trả lời.
                  </p>
                </div>
              </div>

              <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h3 className="font-bold text-amber-900">Lưu ý trước khi bắt đầu</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900/80">
                  <li>• Chuẩn bị tai nghe và giữ kết nối mạng ổn định.</li>
                  <li>• Thời gian được tính ở backend nên tải lại trang không làm dừng đồng hồ.</li>
                  <li>• Khi Listening hết giờ, hệ thống tự chuyển sang Reading.</li>
                  <li>• Khi Reading hết giờ, bài được tự động nộp và khóa đáp án.</li>
                </ul>
              </div>
            </div>

            <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-500">Tổng quan</p>
              <dl className="mt-5 space-y-4">
                {[
                  ["Số câu", `${test?.totalQuestions || 200}`],
                  ["Tổng thời gian", `${test?.totalMinutes || 120} phút`],
                  ["Hình thức", "Full Test"],
                  ["Kết quả", "Chấm tự động"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-slate-200 pb-3">
                    <dt className="text-sm text-slate-500">{label}</dt>
                    <dd className="text-sm font-bold text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>

              {currentAttempt && (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Bạn có một bài đang làm ở phần {currentAttempt.currentSection}. Hệ thống sẽ tiếp tục đúng vị trí đã lưu.
                </div>
              )}

              <button
                type="button"
                onClick={startTest}
                disabled={starting}
                className="mt-6 w-full rounded-2xl bg-sky-500 px-5 py-4 font-bold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-600 disabled:cursor-wait disabled:bg-sky-300"
              >
                {starting
                  ? "Đang chuẩn bị bài thi..."
                  : currentAttempt
                    ? "Tiếp tục bài đang làm"
                    : "Bắt đầu làm bài"}
              </button>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}

export default FullTestIntro;
