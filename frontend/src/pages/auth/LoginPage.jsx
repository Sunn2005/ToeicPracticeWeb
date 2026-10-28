import { canUseConsole, consoleHome, consoleRoutePermission } from "../../auth/consolePermissions";
import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/LanguageContext";
import BrandLogo from "../../components/BrandLogo";
import { auth } from "../../firebase";

const STAFF_ROLES = new Set(["ADMIN", "EMPLOYEE"]);

function toStaffEmail(identifier) {
  const normalized = identifier.trim().toLowerCase();
  if (normalized.includes("@")) return normalized;
  const domain = import.meta.env.VITE_STAFF_EMAIL_DOMAIN || "staff.capytoeic.internal";
  return `${normalized}@${domain}`;
}

function authErrorMessage(error) {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Tên đăng nhập hoặc mật khẩu không chính xác.";
    case "auth/too-many-requests":
      return "Tài khoản tạm thời bị giới hạn do đăng nhập sai nhiều lần. Vui lòng thử lại sau.";
    case "auth/network-request-failed":
      return "Không thể kết nối đến máy chủ xác thực. Vui lòng kiểm tra mạng.";
    case "auth/operation-not-allowed":
      return "Đăng nhập bằng mật khẩu chưa được bật trong Firebase Authentication.";
    default:
      return error?.message || "Không thể đăng nhập vào Console.";
  }
}

function LoginPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, profile: currentProfile, profileLoading, establishSession, logout } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    document.title = "Đăng nhập Console | CapyTOEIC";
  }, []);

  if (user && STAFF_ROLES.has(role)) {
    return <Navigate to={consoleHome(currentProfile)} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        toStaffEmail(username),
        password,
      );
      const profile = await establishSession(credential.user);
      const nextRole = String(profile?.role || "").toUpperCase();

      if (!STAFF_ROLES.has(nextRole)) {
        await logout();
        setErrorMessage("Tài khoản này không có quyền truy cập trang quản trị.");
        return;
      }

      const destination = location.state?.from;
      navigate(profile?.passwordChangeRequired ? "/console/change-password" : destination?.startsWith("/console/") && canUseConsole(profile, consoleRoutePermission(destination)) ? destination : consoleHome(profile), {
        replace: true,
      });
    } catch (error) {
      setErrorMessage(authErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f3f7fc] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[minmax(360px,0.88fr)_minmax(520px,1.12fr)]">
        <section className="relative hidden overflow-hidden bg-[#1486ee] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20 xl:py-14">
          <div className="absolute -left-28 top-24 h-80 w-80 rounded-full bg-white/8" />
          <div className="absolute -bottom-36 -right-20 h-[28rem] w-[28rem] rounded-full bg-cyan-300/15" />
          <div className="relative flex items-center gap-3 text-xl font-bold">
          </div>

          <div className="relative max-w-xl pb-16">
            <div className="mb-8 grid h-24 w-24 place-items-center rounded-[2rem] bg-white/15 ring-1 ring-white/20 backdrop-blur">
              <BrandLogo decorative className="h-20 w-20" />
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-100">Management Console</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight xl:text-5xl">
              Quản lý nội dung TOEIC trên một không gian thống nhất.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-blue-100 xl:text-lg">
              Theo dõi đề thi, gửi yêu cầu phê duyệt và kiểm soát chất lượng nội dung dành cho đội ngũ CapyTOEIC.
            </p>
          </div>

          <p className="relative text-sm text-blue-100">© 2026 CapyTOEIC. Khu vực dành cho nhân sự được cấp quyền.</p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-9 flex items-center gap-3 lg:hidden">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#2188ee] font-bold text-white">T</span>
              <span className="text-xl font-bold text-[#2188ee]">TOEIC Master</span>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-7 shadow-xl shadow-slate-200/70 sm:p-10">
              <div>
                <p className="text-sm font-semibold text-[#2188ee]">ADMIN & EMPLOYEE</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Đăng nhập Console</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Sử dụng tài khoản nội bộ do quản trị viên cấp.
                </p>
              </div>

              {location.state?.passwordChanged && <p role="status" className="mt-4 text-sm text-green-700">{t("staffPasswordChanged")}</p>}
              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="console-username" className="mb-2 block text-sm font-semibold text-slate-700">Tên đăng nhập</label>
                  <div className="relative">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 21a7 7 0 0 1 14 0" />
                    </svg>
                    <input id="console-username" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Nhập tên đăng nhập" className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" />
                  </div>
                </div>

                <div>
                  <label htmlFor="console-password" className="mb-2 block text-sm font-semibold text-slate-700">Mật khẩu</label>
                  <div className="relative">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400">
                      <rect x="4" y="10" width="16" height="11" rx="2" />
                      <path strokeLinecap="round" d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>
                    <input id="console-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu" className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-14 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" />
                    <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-blue-600">
                      {showPassword ? "Ẩn" : "Hiện"}
                    </button>
                  </div>
                </div>

                {errorMessage && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">{errorMessage}</p>}

                <button type="submit" disabled={isSubmitting || profileLoading} className="flex h-13 w-full items-center justify-center rounded-xl bg-[#2188ee] px-5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-blue-300">
                  {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
                </button>
              </form>

              <Link to="/console/forgot-password" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 underline">{t("staffForgotPassword")}</Link>
              <a href="/" className="mt-7 block text-center text-sm font-medium text-slate-500 transition hover:text-blue-600">← Quay lại trang luyện thi</a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default LoginPage;
