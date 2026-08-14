import { useState } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";

function UserAvatar({ user, displayName, size = "large" }) {
  const sizeClasses =
    size === "small"
      ? "h-10 w-10 rounded-xl text-sm"
      : "h-20 w-20 rounded-3xl text-2xl";

  if (user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={`Ảnh đại diện của ${displayName}`}
        referrerPolicy="no-referrer"
        className={`${sizeClasses} shrink-0 border-2 border-white object-cover shadow-md`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} flex shrink-0 items-center justify-center bg-sky-500 font-bold text-white shadow-md`}
      aria-hidden="true"
    >
      {displayName.charAt(0).toUpperCase()}
    </div>
  );
}

function Welcome({ user }) {
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const displayName = user?.displayName || "bạn";

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setSignOutError("");

    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Không thể đăng xuất:", error);
      setSignOutError("Không thể đăng xuất lúc này. Vui lòng thử lại.");
      setIsSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-sky-50 to-cyan-100 text-slate-900">
      <header className="border-b border-white/80 bg-white/80 shadow-sm backdrop-blur-xl">
        <div className="flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-3 rounded-xl text-left focus:outline-none focus:ring-4 focus:ring-sky-100"
            aria-label="Về trang tổng quan"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 font-bold text-white shadow-lg shadow-sky-200">
              TP
            </span>
            <span>
              <span className="block text-lg font-bold leading-tight text-slate-950">
                TOEIC Practice
              </span>
              <span className="hidden text-xs text-slate-500 sm:block">
                Luyện tập thông minh mỗi ngày
              </span>
            </span>
          </button>

          <div className="flex items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="max-w-48 truncate text-sm font-semibold text-slate-900">
                {displayName}
              </p>
              <p className="max-w-48 truncate text-xs text-slate-500">
                {user?.email}
              </p>
            </div>
            <UserAvatar user={user} displayName={displayName} size="small" />
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSigningOut ? "Đang đăng xuất..." : "Đăng xuất"}
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        {signOutError && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
          >
            {signOutError}
          </div>
        )}

        <div className="grid w-full gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="overflow-hidden rounded-3xl bg-sky-500 p-6 text-white shadow-xl shadow-sky-200/70 sm:p-7">
              <UserAvatar user={user} displayName={displayName} />
              <p className="mt-6 text-sm font-medium text-sky-100">Xin chào,</p>
              <h1 className="mt-1 break-words text-2xl font-bold">{displayName}</h1>
              <p className="mt-2 break-all text-sm text-sky-100">{user?.email}</p>

              <div className="mt-7 rounded-2xl bg-white/15 p-5 ring-1 ring-white/20">
                <p className="text-sm font-medium text-sky-100">Mục tiêu tuần này</p>
                <p className="mt-2 text-3xl font-bold">+60 điểm</p>
                <p className="mt-3 text-sm leading-6 text-sky-50">
                  Duy trì nhịp học đều và xem lại lỗi sai sau mỗi phiên luyện tập.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-white bg-white/80 p-6 shadow-lg shadow-sky-100/70 backdrop-blur">
              <p className="text-sm font-semibold text-slate-900">Gợi ý hôm nay</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                  Làm một bài Part 5 ngắn
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                  Ghi lại từ vựng chưa chắc
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                  Xem lại câu trả lời sai
                </li>
              </ul>
            </section>
          </aside>

          <section className="min-w-0 space-y-6">
            <div className="rounded-3xl border border-white bg-white/80 p-6 shadow-xl shadow-sky-100/70 backdrop-blur sm:p-8">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">
                    Tổng quan học tập
                  </p>
                  <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                    Sẵn sàng cho phiên luyện tập hôm nay
                  </h2>
                  <p className="mt-3 max-w-2xl leading-7 text-slate-600">
                    Chọn bài phù hợp, hoàn thành từng phần và theo dõi tiến độ của
                    bạn qua mỗi lần luyện tập.
                  </p>
                </div>
                <span className="w-fit shrink-0 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                  Đang hoạt động
                </span>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  ["12", "Bài đã hoàn thành"],
                  ["86%", "Độ chính xác"],
                  ["5 ngày", "Chuỗi học tập"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-sky-100 bg-sky-50/70 p-5"
                  >
                    <p className="text-3xl font-bold text-slate-950">{value}</p>
                    <p className="mt-2 text-sm text-slate-600">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white bg-white/80 p-6 shadow-xl shadow-sky-100/70 backdrop-blur sm:p-8">
              <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">
                    Bài luyện hiện có
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-950">
                    Chọn bài để bắt đầu
                  </h3>
                </div>
                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  2 bài sẵn sàng
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate("/full-test/ets-2026-test-1")}
                className="group mb-5 w-full overflow-hidden rounded-3xl bg-slate-950 p-6 text-left text-white shadow-xl transition duration-200 hover:-translate-y-1 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-sky-200 sm:p-7"
              >
                <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                  <div className="flex items-start gap-4 sm:gap-5">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-sky-400 to-cyan-400 text-lg font-black text-slate-950 shadow-lg shadow-sky-900/40 sm:h-16 sm:w-16">
                      FT
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-sky-300">
                          ETS 2026 · Full Test
                        </p>
                        <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-300/20">
                          Mới
                        </span>
                      </div>
                      <p className="mt-2 text-xl font-bold sm:text-2xl">
                        TOEIC Listening & Reading – Test 1
                      </p>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                        Mô phỏng đủ 200 câu với Listening 45 phút, Reading 75 phút,
                        tự động lưu và chấm điểm sau khi nộp.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                        <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/10">
                          200 câu
                        </span>
                        <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/10">
                          120 phút
                        </span>
                        <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/10">
                          Part 1–7
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 self-end font-bold text-sky-300 transition group-hover:translate-x-1 md:self-auto">
                    Xem đề thi →
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate("/practice/part5")}
                className="group w-full rounded-3xl border border-sky-100 bg-linear-to-br from-white to-sky-50 p-6 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 focus:outline-none focus:ring-4 focus:ring-sky-100 sm:p-7"
              >
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                  <div className="flex items-start gap-4 sm:gap-5">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-lg font-bold text-white shadow-lg shadow-sky-200 sm:h-16 sm:w-16">
                      P5
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">
                        Test 001 · Reading
                      </p>
                      <p className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">
                        Part 5: Incomplete Sentences
                      </p>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        Luyện ngữ pháp và từ vựng bằng các câu hoàn thành câu.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                        <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
                          Reading
                        </span>
                        <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
                          Part 5
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 self-end font-semibold text-sky-600 transition group-hover:translate-x-1 md:self-auto">
                    Vào bài →
                  </span>
                </div>
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Welcome;
