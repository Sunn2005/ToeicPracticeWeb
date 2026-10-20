import { useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import { useLanguage } from "../../i18n/LanguageContext";

const FAQ_COUNT = 6;
const ISSUES_URL = "https://github.com/Sunn2005/ToeicPracticeWeb/issues/new";

function FaqItem({ question, answer, open, onToggle, id }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h3>
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`${id}-panel`}
                    id={`${id}-button`}
                    onClick={onToggle}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left text-sm font-bold text-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 sm:text-base"
                >
                    <span>{question}</span>
                    <svg
                        viewBox="0 0 24 24"
                        className={`h-5 w-5 shrink-0 text-[#2188ee] transition-transform ${open ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                    >
                        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </h3>
            {open && (
                <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-button`} className="px-5 pb-5 text-sm leading-6 text-slate-600">
                    {answer}
                </div>
            )}
        </div>
    );
}

export default function SupportPage() {
    const { t } = useLanguage();
    const [openIndex, setOpenIndex] = useState(0);

    useEffect(() => {
        document.title = t("supportDocTitle");
    }, [t]);

    const faqs = Array.from({ length: FAQ_COUNT }, (_, index) => ({
        question: t(`supportFaq${index + 1}Q`),
        answer: t(`supportFaq${index + 1}A`),
    }));

    return (
        <div className="bg-slate-50">
            <section className="bg-linear-to-br from-sky-50 via-blue-50 to-cyan-100">
                <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-16">
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                        {t("supportTitle")}
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                        {t("supportSubtitle")}
                    </p>
                </div>
            </section>

            <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
                <h2 className="text-xl font-extrabold text-slate-950">{t("supportFaqTitle")}</h2>
                <div className="mt-5 space-y-3">
                    {faqs.map((faq, index) => (
                        <FaqItem
                            key={faq.question}
                            id={`faq-${index}`}
                            question={faq.question}
                            answer={faq.answer}
                            open={openIndex === index}
                            onToggle={() => setOpenIndex(openIndex === index ? -1 : index)}
                        />
                    ))}
                </div>

                <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <h2 className="text-xl font-extrabold text-slate-950">{t("supportReportTitle")}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{t("supportReportDesc")}</p>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <a
                            href={ISSUES_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-xl bg-[#2188ee] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1a74cf] focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
                        >
                            {t("supportReportButton")}
                        </a>
                        <Button to="/" variant="secondary">{t("supportBackHome")}</Button>
                    </div>
                </div>
            </section>
        </div>
    );
}
