import { auth } from "../firebase";

function Welcome() {
  const user = auth.currentUser;
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

              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                {[
                  ["Listening Sprint", "Luyện phản xạ nghe với bộ câu hỏi ngắn."],
                  ["Reading Focus", "Ôn ngữ pháp, từ vựng và đọc hiểu theo phần."],
                  ["Review Mistakes", "Xem lại lỗi thường gặp để cải thiện nhanh hơn."],
                  ["Mock Test", "Làm đề mô phỏng khi bạn đã sẵn sàng tăng tốc."],
                ].map(([title, desc]) => (
                  <button
                    key={title}
                    className="rounded-3xl border border-slate-100 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg hover:shadow-sky-100 focus:outline-none focus:ring-4 focus:ring-sky-100"
                  >
                    <p className="font-semibold text-slate-950">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Welcome;
