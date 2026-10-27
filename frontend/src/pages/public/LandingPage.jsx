import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPublicTests } from "../../api/publicTests.js";
import { useLanguage } from "../../i18n/LanguageContext";

const FEATURED_TEST_LIMIT = 6;

const LISTENING_PARTS = [
    { nameKey: "landingPartPhotographs", count: 6 },
    { nameKey: "landingPartQuestionResponse", count: 25 },
    { nameKey: "landingPartConversations", count: 39 },
    { nameKey: "landingPartTalks", count: 30 },
];

const READING_PARTS = [
    { nameKey: "landingPartIncompleteSentences", count: 30 },
    { nameKey: "landingPartTextCompletion", count: 16 },
    { nameKey: "landingPartReadingComprehension", count: 54 },
];

const FEATURES = [
    { icon: "book", titleKey: "landingFeature1Title", descKey: "landingFeature1Desc", pro: false },
    { icon: "chart", titleKey: "landingFeature2Title", descKey: "landingFeature2Desc", pro: false },
    { icon: "ai", titleKey: "landingFeature3Title", descKey: "landingFeature3Desc", pro: true },
    { icon: "target", titleKey: "landingFeature4Title", descKey: "landingFeature4Desc", pro: true },
];

const STATS = [
    { value: "200", labelKey: "landingStat1Label" },
    { value: "7", labelKey: "landingStat2Label" },
    { value: "990", labelKey: "landingStat3Label" },
];

const PRO_BENEFITS = ["landingProBenefit1", "landingProBenefit2", "landingProBenefit3"];

const TAG_CLASSES = {
    full: "bg-sky-50 text-sky-600",
    mini: "bg-emerald-50 text-emerald-700",
    practice: "bg-violet-50 text-violet-700",
};

function Icon({ name, className = "h-6 w-6" }) {
    const paths = {
        headphones: <path d="M4 15v-3a8 8 0 0 1 16 0v3M4 15a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2zm16 0a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2z" />,
        book: <path d="M12 6.5C10.5 5.5 8.5 5 6 5H4v13h2c2.5 0 4.5.5 6 1.5M12 6.5C13.5 5.5 15.5 5 18 5h2v13h-2c-2.5 0-4.5.5-6 1.5M12 6.5v13" />,
        chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
        ai: <path d="M12 3a4 4 0 0 0-4 4v1a3 3 0 0 0-2 5 3 3 0 0 0 2 5 4 4 0 0 0 8 0 3 3 0 0 0 2-5 3 3 0 0 0-2-5V7a4 4 0 0 0-4-4zM12 3v18" />,
        target: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />,
        lock: <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6v-9z" />,
        clock: <path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />,
        check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
        arrowDown: <path d="M12 4v16m0 0 6-6m-6 6-6-6" />,
    };
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {paths[name]}
        </svg>
    );
}

function SectionHeading({ label, title }) {
    return (
        <div className="text-center">
            <span className="inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-sky-700">
                {label}
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
        </div>
    );
}

function HeroPreview() {
    const { t } = useLanguage();
    return (
        <div className="relative mx-auto w-full max-w-lg" aria-hidden="true">
            <div className="overflow-hidden rounded-3xl bg-linear-to-br from-sky-100 via-sky-50 to-white p-8 shadow-xl shadow-sky-100 sm:p-10">
                <img
                    src="/brand/toeic-mascot.png"
                    alt=""
                    className="mx-auto w-full max-w-xs object-contain"
                    draggable="false"
                />
            </div>
            <div className="absolute -left-3 bottom-8 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-lg shadow-slate-200/70 sm:-left-6">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("landingPreviewScoreLabel")}</p>
                <p className="mt-0.5 text-lg font-extrabold text-slate-900">825<span className="text-sm font-bold text-slate-400">/990</span></p>
            </div>
            <div className="absolute -right-3 top-8 flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-lg shadow-slate-200/70 sm:-right-6">
                <img src="/brand/LogochatboxCapyAI.png" alt="" className="h-9 w-9 rounded-full object-cover" draggable="false" />
                <div>
                    <p className="text-sm font-bold text-slate-900">Capy AI</p>
                    <p className="text-[11px] font-medium text-slate-500">{t("landingPreviewAiLabel")}</p>
                </div>
            </div>
        </div>
    );
}

function ExamStructureCard({ icon, title, meta, parts }) {
    const { t } = useLanguage();
    return (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-md shadow-slate-200/60">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-600">
                        <Icon name={icon} />
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                </div>
                <span className="text-sm font-semibold text-slate-700">{meta}</span>
            </div>
            <ul className="mt-4 space-y-4">
                {parts.map((part) => (
                    <li key={part.nameKey}>
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700">{t(part.nameKey)}</span>
                            <span className="font-semibold text-sky-600">{part.count} {t("landingUnitQuestions")}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100">
                            <div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${part.count}%` }} />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function getTestKind(test) {
    return { FULL_TEST: "full", MINI_TEST: "mini", PRACTICE: "practice" }[test.type] || "full";
}

function FeaturedTests() {
    const { t } = useLanguage();
    const [tests, setTests] = useState([]);
    const [status, setStatus] = useState("loading");
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        getPublicTests()
            .then((data) => {
                if (cancelled) return;
                setTests(Array.isArray(data) ? data.slice(0, FEATURED_TEST_LIMIT) : []);
                setStatus("success");
            })
            .catch(() => {
                if (cancelled) return;
                setStatus("error");
            });

        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    const handleRetry = () => {
        setStatus("loading");
        setReloadKey((key) => key + 1);
    };

    if (status === "loading") {
        return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label={t("landingTestsLoading")}>
                {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="motion-safe:animate-pulse rounded-xl border border-slate-200 bg-white p-4">
                        <div className="h-5 w-20 rounded bg-slate-100" />
                        <div className="mt-4 h-5 w-3/4 rounded bg-slate-100" />
                        <div className="mt-2 h-4 w-1/2 rounded bg-slate-100" />
                        <div className="mt-5 h-8 w-32 rounded-lg bg-slate-100" />
                    </div>
                ))}
            </div>
        );
    }

    if (status === "error") {
        return (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
                <h3 className="text-base font-bold text-slate-900">{t("landingTestsError")}</h3>
                <button
                    type="button"
                    onClick={handleRetry}
                    className="mt-5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
                >
                    {t("landingTestsRetry")}
                </button>
            </div>
        );
    }

    if (tests.length === 0) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
                <h3 className="text-base font-bold text-slate-900">{t("landingTestsEmpty")}</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{t("landingTestsEmptyDesc")}</p>
            </div>
        );
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tests.map((test) => {
                const kind = getTestKind(test);
                const minutes = test.totalMinutes;
                return (
                    <article key={test.testId || test.id || test.title} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition motion-safe:hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none">
                        <div className="flex items-center justify-between gap-3">
                            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${TAG_CLASSES[kind]}`}>
                                {t(`landingTag_${kind}`)}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                                <Icon name="clock" className="h-3.5 w-3.5" />
                                {minutes != null ? `${minutes} ${t("landingUnitMinutes")}` : t("landingMetadataUnavailable")}
                            </span>
                        </div>
                        <h3 className="mt-3 line-clamp-2 text-base font-bold text-slate-900">{test.title}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                            {test.totalQuestions != null ? `${test.totalQuestions} ${t("landingUnitQuestions")}` : t("landingMetadataUnavailable")}
                        </p>
                        <div className="mt-4">
                            <Link
                                to="/login"
                                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
                            >
                                <Icon name="lock" className="h-3.5 w-3.5" />
                                {t("landingTestsCta")}
                            </Link>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}

/**
 * Public landing page rendered at "/" for guests (see App.jsx).
 * Uses only the public catalog API; every start-attempt action routes
 * to /login instead of calling authenticated endpoints.
 */
export default function LandingPage() {
    const { t } = useLanguage();

    useEffect(() => {
        document.title = t("landingDocTitle");
    }, [t]);

    return (
        <div className="bg-white">
            {/* Hero */}
            <section className="bg-[#f3f6fa]">
                <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2">
                    <div>
                        <span className="inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-sky-700">
                            {t("landingHeroBadge")}
                        </span>
                        <h1 className="mt-5 text-4xl font-extrabold whitespace-pre-line leading-tight tracking-tight text-slate-900 sm:text-5xl">
                            {t("landingHeroTitle")}
                        </h1>
                        <p className="mt-5 max-w-md text-base leading-7 text-slate-600">{t("landingHeroSubtitle")}</p>
                        <div className="mt-7 flex flex-wrap items-center gap-5">
                            <Link
                                to="/login"
                                className="inline-flex min-h-11 items-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
                            >
                                {t("landingHeroCtaPrimary")}
                            </Link>
                            <Link to="/#tests" className="inline-flex items-center gap-2 text-base font-semibold text-slate-800 hover:text-sky-700">
                                {t("landingHeroCtaTests")}
                                <Icon name="arrowDown" className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                    <HeroPreview />
                </div>
            </section>

            {/* Exam structure */}
            <section className="bg-white">
                <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
                    <SectionHeading label={t("landingStructureLabel")} title={t("landingStructureTitle")} />
                    <div className="mt-10 grid items-start gap-6 md:grid-cols-2">
                        <ExamStructureCard icon="headphones" title="Listening" meta={t("landingListeningMeta")} parts={LISTENING_PARTS} />
                        <ExamStructureCard icon="book" title="Reading" meta={t("landingReadingMeta")} parts={READING_PARTS} />
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" className="scroll-mt-16 bg-[#f3f6fa]">
                <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
                    <SectionHeading label={t("landingFeaturesLabel")} title={t("landingFeaturesTitle")} />
                    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {FEATURES.map((feature) => (
                            <div key={feature.titleKey} className="rounded-xl bg-white p-5 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-600">
                                        <Icon name={feature.icon} />
                                    </span>
                                    {feature.pro && (
                                        <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white">
                                            {t("landingProBadge")}
                                        </span>
                                    )}
                                </div>
                                <h3 className="mt-4 text-base font-bold text-slate-900">{t(feature.titleKey)}</h3>
                                <p className="mt-2 text-sm leading-6 text-slate-500">{t(feature.descKey)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Explore tests */}
            <section id="tests" className="scroll-mt-16 bg-white">
                <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
                    <h2 className="text-center text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                        {t("landingTestsTitle")}
                    </h2>
                    <div className="mt-8">
                        <FeaturedTests />
                    </div>
                    <p className="mt-10 text-center">
                        <Link to="/login" className="text-sm font-semibold text-sky-700 underline underline-offset-2">
                            {t("landingTestsViewAll")}
                        </Link>
                    </p>
                </div>
            </section>

            {/* Stats */}
            <section className="bg-[#f3f6fa]">
                <dl className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-14 text-center sm:grid-cols-3 sm:px-6">
                    {STATS.map((stat) => (
                        <div key={stat.labelKey} className="flex flex-col">
                            <dd className="order-1 text-5xl font-extrabold text-sky-600">{stat.value}</dd>
                            <dt className="order-2 mt-1 text-sm text-slate-600">{t(stat.labelKey)}</dt>
                        </div>
                    ))}
                </dl>
            </section>

            {/* Pro */}
            <section id="pro" className="scroll-mt-16 bg-white">
                <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-2">
                    <div>
                        <span className="inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-sky-700">
                            {t("landingProBadge")}
                        </span>
                        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{t("landingProTitle")}</h2>
                        <p className="mt-3 max-w-md text-base leading-7 text-slate-600">{t("landingProSubtitle")}</p>
                        <ul className="mt-6 space-y-3">
                            {PRO_BENEFITS.map((benefitKey) => (
                                <li key={benefitKey} className="flex items-start gap-3 text-sm font-medium text-slate-700">
                                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700">
                                        <Icon name="check" className="h-3.5 w-3.5" />
                                    </span>
                                    {t(benefitKey)}
                                </li>
                            ))}
                        </ul>
                        <div className="mt-7 flex items-center gap-4">
                            <img src="/brand/CapyPro.png" alt="" className="h-16 w-16 rounded-2xl object-cover" draggable="false" />
                            <p className="text-xs leading-5 text-slate-500">{t("pricingTrustSecure")}</p>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-wide text-sky-600">{t("pricingTrialBadge")}</p>
                            <h3 className="mt-2 text-lg font-bold text-slate-900">{t("pricingTrialName")}</h3>
                            <p className="mt-3 text-3xl font-extrabold text-slate-900">{t("landingProTrialPrice")}</p>
                            <p className="mt-1 text-sm text-slate-500">{t("landingProTrialNote")}</p>
                        </div>
                        <div className="relative rounded-2xl border-2 border-sky-500 bg-white p-6 shadow-md shadow-sky-100">
                            <span className="absolute -top-3 left-5 rounded-full bg-sky-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                                {t("pricingPopular")}
                            </span>
                            <p className="text-xs font-bold uppercase tracking-wide text-sky-600">{t("landingProBadge")}</p>
                            <h3 className="mt-2 text-lg font-bold text-slate-900">{t("pricingMonthlyName")}</h3>
                            <p className="mt-3 text-3xl font-extrabold text-slate-900">{t("landingProMonthlyPrice")}</p>
                            <p className="mt-1 text-sm text-slate-500">{t("landingProMonthlyNote")}</p>
                        </div>
                        <Link
                            to="/login"
                            className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 sm:col-span-2"
                        >
                            {t("landingProCta")}
                        </Link>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="bg-linear-to-b from-sky-600 to-blue-800 text-center text-white">
                <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
                    <h2 className="text-4xl font-extrabold tracking-tight">{t("landingCtaTitle")}</h2>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">{t("landingGoogleSignInSubtitle")}</p>
                    <Link
                        to="/login"
                        className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-sky-700 shadow-sm transition hover:bg-sky-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                    >
                        {t("landingCtaButton")}
                    </Link>
                </div>
            </section>
        </div>
    );
}
