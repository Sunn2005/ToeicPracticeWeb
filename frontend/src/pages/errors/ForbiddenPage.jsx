import { signOut } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../../firebase";

function ForbiddenPage() {
  const navigate = useNavigate();

  const useAnotherAccount = async () => {
    await signOut(auth);
    navigate("/console", { replace: true });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/70 sm:p-12">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-2xl font-bold text-red-600">403</span>
        <h1 className="mt-6 text-2xl font-bold text-slate-950">Bạn không có quyền truy cập</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Console chỉ dành cho tài khoản ADMIN hoặc EMPLOYEE đã được cấp quyền.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={useAnotherAccount} className="rounded-xl bg-[#2188ee] px-5 py-3 text-sm font-bold text-white hover:bg-blue-600">Đăng nhập tài khoản khác</button>
          <Link to="/" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">Về trang luyện thi</Link>
        </div>
      </section>
    </main>
  );
}

export default ForbiddenPage;
