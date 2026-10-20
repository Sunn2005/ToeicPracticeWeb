// TODO(Member 1): Implement the 404 page.
import { useEffect } from "react";
import BrandLogo from "../../components/BrandLogo";
import Button from "../../components/ui/Button";
import { useLanguage } from "../../i18n/LanguageContext";

export default function NotFoundPage() {
    const { t } = useLanguage();

    useEffect(() => {
        document.title = t("notFoundTitle");
    }, [t]);

    return (
        <main className="grid min-h-screen min-h-dvh place-items-center bg-linear-to-br from-sky-50 via-white to-cyan-50 px-5">
            <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/70 sm:p-12">
                <BrandLogo decorative className="mx-auto h-24 w-24" />
                <p className="mt-4 text-5xl font-extrabold tracking-tight text-[#2188ee]">404</p>
                <h1 className="mt-3 text-2xl font-bold text-slate-950">{t("notFoundTitle")}</h1>
                <p className="mt-3 text-sm leading-6 text-slate-500">{t("notFoundDesc")}</p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                    <Button to="/" size="lg">{t("notFoundHome")}</Button>
                    <Button to="/support" size="lg" variant="secondary">{t("notFoundSupport")}</Button>
                </div>
            </section>
        </main>
    );
}
