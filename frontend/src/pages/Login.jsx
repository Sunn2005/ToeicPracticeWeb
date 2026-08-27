import {
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";

function Login() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loginWithGoogle = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      await signInWithPopup(auth, provider);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error(error);

      if (error.code === "auth/unauthorized-domain") {
        setErrorMessage(
          t("unauthorizedDomain"),
        );
      } else if (error.message?.includes("Database is closing/hidden")) {
        setErrorMessage(
          t("sessionSaveError"),
        );
      } else {
        setErrorMessage(
          `${t("googleSignInError")} ${error.code || error.message}`,
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-sky-50 via-blue-50 to-cyan-100 text-slate-900">
      <LanguageSwitcher className="fixed right-4 top-4 z-50" />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10">
        <section className="grid w-full items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/70 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              {t("loginTagline")}
            </div>

            <div className="space-y-5">
              <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                TOEIC Practice
              </h1>
              <p className="max-w-xl text-lg leading-8 text-slate-600">
                {t("loginDescription")}
              </p>
            </div>

            <div className="grid max-w-xl grid-cols-3 gap-3">
              {[
                [t("listening"), "Part 1-4"],
                [t("reading"), "Part 5-7"],
                [t("progress"), t("trackYourScore")],
              ].map(([title, desc]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/80 bg-white/60 p-4 shadow-sm backdrop-blur"
                >
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                  <p className="mt-1 text-xs text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="rounded-4xl border border-white/80 bg-white/85 p-7 shadow-2xl shadow-sky-200/70 backdrop-blur-xl sm:p-8">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-sky-600">{t("welcome")}</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-950">
                    {t("signInToStart")}
                  </h2>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-xl font-bold text-sky-600 shadow-inner">
                  TP
                </div>
              </div>

              <button
                type="button"
                onClick={loginWithGoogle}
                disabled={isLoading}
                className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-sky-500 px-5 py-4 text-base font-semibold text-white shadow-lg shadow-sky-300/70 transition duration-200 hover:-translate-y-0.5 hover:bg-sky-600 focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-sky-300 disabled:shadow-none"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-bold text-sky-600">
                  G
                </span>
                {isLoading ? t("openingGoogle") : t("continueWithGoogle")}
              </button>

              {errorMessage && (
                <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-600">
                  {errorMessage}
                </p>
              )}

              <div className="mt-7 rounded-2xl bg-sky-50 p-5">
                <p className="text-sm font-semibold text-slate-800">
                  {t("practiceToday")}
                </p>
                <div className="mt-4 space-y-3">
                  {[t("miniTest"), t("topicVocabulary"), t("reviewIncorrectAnswers")].map(
                    (item) => (
                      <div key={item} className="flex items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                        <span className="text-sm text-slate-600">{item}</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Login;
