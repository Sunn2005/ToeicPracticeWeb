import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../auth/useAuth";
import BrandLogo from "../components/BrandLogo";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";

const GOOGLE_SIGN_IN_ERROR_KEYS = {
  "auth/cancelled-popup-request": "popupClosedError",
  "auth/network-request-failed": "networkSignInError",
  "auth/popup-blocked": "popupBlockedError",
  "auth/popup-closed-by-user": "popupClosedError",
  "auth/unauthorized-domain": "unauthorizedDomain",
};

function Login() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { establishSession, profileError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loginWithGoogle = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const credential = await signInWithPopup(auth, provider);
      await establishSession(credential.user);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const errorCode = typeof error?.code === "string" ? error.code : "unknown";
      console.error("Google sign-in failed", errorCode);

      if (error?.message?.includes("Database is closing/hidden")) {
        setErrorMessage(t("sessionSaveError"));
      } else {
        setErrorMessage(t(GOOGLE_SIGN_IN_ERROR_KEYS[errorCode] || "googleSignInError"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = [
    [t("listening"), "Part 1-4"],
    [t("reading"), "Part 5-7"],
    [t("progress"), t("trackYourScore")],
  ];

  const practiceIdeas = [
    t("miniTest"),
    t("topicVocabulary"),
    t("reviewIncorrectAnswers"),
  ];

  return (
    <div className="min-h-screen min-h-dvh bg-linear-to-br from-sky-50 via-blue-50 to-cyan-100 text-slate-900">
      <LanguageSwitcher className="fixed right-3 top-3 z-50 sm:right-5 sm:top-5" />

      <main className="mx-auto flex min-h-screen min-h-dvh w-full max-w-6xl items-center px-4 pb-8 pt-20 sm:px-6 sm:py-24 lg:py-12">
        <h1 className="sr-only">{t("loginPageTitle")}</h1>

        <section
          aria-label={t("loginPageTitle")}
          className="grid w-full items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12"
        >
          <div className="login-card mx-auto w-full max-w-md lg:order-2">
            <div className="rounded-3xl border border-white/90 bg-white/90 p-5 shadow-xl shadow-sky-200/55 backdrop-blur-xl sm:rounded-4xl sm:p-8">
              <div className="mb-6 flex items-center justify-between gap-4 sm:mb-8">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-sky-700">{t("welcome")}</p>
                  <h2 className="mt-1.5 text-xl font-bold text-slate-950 sm:mt-2 sm:text-2xl">
                    {t("signInToStart")}
                  </h2>
                </div>
                <BrandLogo
                  decorative
                  className="h-14 w-14 shrink-0 rounded-2xl border border-sky-100 bg-white shadow-sm sm:h-16 sm:w-16"
                />
              </div>

              <button
                type="button"
                onClick={loginWithGoogle}
                disabled={isLoading}
                aria-busy={isLoading}
                aria-describedby="google-sign-in-support"
                className="group flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl bg-sky-500 px-4 py-3 text-base font-semibold text-white shadow-md shadow-sky-300/60 transition duration-200 hover:-translate-y-0.5 hover:bg-sky-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transform-none motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-sky-300 disabled:shadow-none"
              >
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-sky-700"
                >
                  {isLoading ? (
                    <span className="h-4 w-4 rounded-full border-2 border-sky-200 border-t-sky-600 motion-safe:animate-spin" />
                  ) : (
                    "G"
                  )}
                </span>
                <span>{isLoading ? t("openingGoogle") : t("continueWithGoogle")}</span>
              </button>

              <p
                id="google-sign-in-support"
                className="mt-3 text-center text-sm leading-6 text-slate-500"
              >
                {t("googleSignInSupport")}
              </p>

              {(errorMessage || profileError) && (
                <p
                  role="alert"
                  className="mt-4 [overflow-wrap:anywhere] rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
                >
                  {errorMessage || profileError}
                </p>
              )}

              <section
                aria-labelledby="practice-today-title"
                className="mt-6 rounded-2xl border border-sky-100/80 bg-sky-50/75 p-4 sm:mt-7 sm:p-5"
              >
                <h3 id="practice-today-title" className="text-sm font-semibold text-slate-800">
                  {t("practiceToday")}
                </h3>
                <ul className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
                  {practiceIdeas.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400"
                      />
                      <span className="text-sm leading-5 text-slate-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>

          <div className="login-introduction space-y-6 lg:order-1 lg:space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/75 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm backdrop-blur">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-sky-400" />
              {t("loginTagline")}
            </div>

            <div className="space-y-4 sm:space-y-5">
              <img
                src="/brand/capyToeic.png"
                alt=""
                aria-hidden="true"
                className="h-auto w-full max-w-[320px] sm:max-w-[380px] lg:max-w-[420px]"
              />
              <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                {t("loginDescription")}
              </p>
            </div>

            <ul className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
              {benefits.map(([title, description]) => (
                <li
                  key={title}
                  className="rounded-2xl border border-white/90 bg-white/65 p-4 shadow-sm backdrop-blur"
                >
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Login;
