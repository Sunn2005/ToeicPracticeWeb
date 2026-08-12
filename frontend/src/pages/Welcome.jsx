import { useNavigate } from "react-router-dom";

function Welcome({ user }) {
  const navigate = useNavigate();
  const displayName = user?.displayName || "bạn";

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-sky-50 to-cyan-100 px-6 py-8 text-slate-900">
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <section className="w-full overflow-hidden rounded-4xl border border-white/80 bg-white/80 shadow-2xl shadow-sky-200/60 backdrop-blur-xl">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <aside className="bg-sky-500 p-8 text-white sm:p-10">
              <div className="flex items-center gap-4">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Avatar"
                    className="h-20 w-20 rounded-3xl border-4 border-white/40 object-cover shadow-lg"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl border-4 border-white/40 bg-white/20 text-2xl font-bold shadow-lg">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-sky-100">Xin chào</p>
                  <h1 className="truncate text-2xl font-bold">{displayName}</h1>
                  <p className="mt-1 truncate text-sm text-sky-100">{user?.email}</p>
                </div>
              </div>

              <div className="mt-10 rounded-3xl bg-white/15 p-6 ring-1 ring-white/20">
                <p className="text-sm font-medium text-sky-100">Mục tiêu tuần này</p>
                <p className="mt-3 text-3xl font-bold">+60 điểm</p>
                <p className="mt-3 text-sm leading-6 text-sky-50">
                  Duy trì nhịp học đều với các bài luyện ngắn và xem lại lỗi sai
                  sau mỗi phiên.
                </p>
              </div>
            </aside>

            <div className="p-8 sm:p-10">
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">
                    TOEIC Practice
                  </p>
                  <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                    Sẵn sàng cho phiên luyện tập hôm nay
                  </h2>
                </div>
                <span className="w-fit rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700">
                  Đang hoạt động
                </span>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  ["12", "Bài đã hoàn thành"],
                  ["86%", "Độ chính xác"],
                  ["5 ngày", "Chuỗi học tập"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-3xl border border-sky-100 bg-sky-50/70 p-5"
                  >
                    <p className="text-3xl font-bold text-slate-950">{value}</p>
                    <p className="mt-2 text-sm text-slate-600">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">
                      Bài luyện hiện có
                    </p>
                    <h3 className="mt-2 text-2xl font-bold text-slate-950">
                      Chọn bài để bắt đầu
                    </h3>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Sẵn sàng
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/practice/part5")}
                  className="group w-full rounded-3xl border border-sky-100 bg-linear-to-br from-white to-sky-50 p-6 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 focus:outline-none focus:ring-4 focus:ring-sky-100"
                >
                  <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                    <div className="flex items-start gap-4">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-lg font-bold text-white shadow-lg shadow-sky-200">
                        P5
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">
                          Test 001 · Reading
                        </p>
                        <p className="mt-2 text-xl font-bold text-slate-950">
                          Part 5: Incomplete Sentences
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Luyện ngữ pháp và từ vựng bằng các câu hoàn thành câu.
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 font-semibold text-sky-600 transition group-hover:translate-x-1">
                      Vào bài →
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Welcome;
