// TODO(Member 1): Implement the public TOEIC landing and published-test preview.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { publicApiFetch } from "../../api/client";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useLanguage } from "../../i18n/LanguageContext";

const FEATURED_TEST_LIMIT = 6;

const LISTENING_PARTS = [
    { name: "Part 1: Photographs", count: 6 },
    { name: "Part 2: Question-Response", count: 25 },
    { name: "Part 3: Conversations", count: 39 },
    { name: "Part 4: Talks", count: 30 },
];

const READING_PARTS = [
    { name: "Part 5: Incomplete Sentences", count: 30 },
    { name: "Part 6: Text Completion", count: 16 },
    { name: "Part 7: Reading Comprehension", count: 54 },
];

const FEATURES = [
    { icon: "book", titleKey: "landingFeature1Title", descKey: "landingFeature1Desc" },
    { icon: "chart", titleKey: "landingFeature2Title", descKey: "landingFeature2Desc" },
    { icon: "ai", titleKey: "landingFeature3Title", descKey: "landingFeature3Desc" },
    { icon: "route", titleKey: "landingFeature4Title", descKey: "landingFeature4Desc" },
];

const STATS = [
    { value: "10,000+", labelKey: "landingStat1Label" },
    { value: "500+", labelKey: "landingStat2Label" },
    { value: "+150", labelKey: "landingStat3Label" },
];

const REVIEWS = [
    { name: "Nguyễn Minh Thư", gain: 180, quoteKey: "landingReview1Quote" },
    { name: "Trần Hoàng Nam", gain: 220, quoteKey: "landingReview2Quote" },
    { name: "Lê Quốc Bảo", gain: 140, quoteKey: "landingReview3Quote" },
];

const TAG_CLASSES = {
    full: "bg-sky-50 text-sky-600",
    listening: "bg-emerald-50 text-emerald-600",
    reading: "bg-violet-50 text-violet-600",
};

function Icon({ name, className = "h-6 w-6" }) {
    const paths = {
        headphones: <path d="M4 15v-3a8 8 0 0 1 16 0v3M4 15a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2zm16 0a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2z" />,
        book: <path d="M12 6.5C10.5 5.5 8.5 5 6 5H4v13h2c2.5 0 4.5.5 6 1.5M12 6.5C13.5 5.5 15.5 5 18 5h2v13h-2c-2.5 0-4.5.5-6 1.5M12 6.5v13" />,
        chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
        ai: <path d="M12 3a4 4 0 0 0-4 4v1a3 3 0 0 0-2 5 3 3 0 0 0 2 5 4 4 0 0 0 8 0 3 3 0 0 0 2-5 3 3 0 0 0-2-5V7a4 4 0 0 0-4-4zM12 3v18" />,
        route: <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10zM12 8.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />,
        lock: <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6v-9z" />,
        clock: <path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />,
        play: <path d="M8 5v14l11-7L8 5z" />,
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
            <span className="inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#3b7fe0]">
                {label}
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
        </div>
    );
}

function HeroPreview() {
    return (
        <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-2xl bg-linear-to-br from-slate-200 via-slate-100 to-slate-300 p-6 shadow-xl shadow-slate-300/60 sm:p-10" aria-hidden="true">
            <div className="rounded-lg border-4 border-slate-800 bg-white p-3 shadow-lg">
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-emerald-50/70 p-3 text-center">
                        <p className="text-xs font-semibold text-slate-500">Full Practice Test</p>
                        <div className="relative mx-auto mt-2 grid h-20 w-20 place-items-center rounded-full border-[5px] border-emerald-300 border-t-slate-200">
                            <span className="text-sm font-extrabold text-slate-800">825/990</span>
                        </div>
                    </div>
                    <div className="rounded-md bg-emerald-50/70 p-3">
                        <p className="text-xs font-semibold text-slate-500">Progress Over Time</p>
                        <svg viewBox="0 0 100 50" className="mt-2 h-20 w-full">
                            <polyline points="2,44 22,34 40,38 60,20 80,24 98,6" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                    {["Meticulous", "Deliberate", "Cautious"].map((word) => (
                        <div key={word} className="rounded bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-600">{word}</div>
                    ))}
                </div>
            </div>
            <div className="mx-auto mt-2 h-2 w-10 rounded-full bg-slate-300" />
        </div>
    );
}

function ExamStructureCard({ icon, title, meta, parts }) {
    const { t } = useLanguage();
    return (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-md shadow-slate-200/60">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-[#4a8cf0]">
            <Icon name={icon} />
          </span>
                    <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                </div>
                <span className="text-sm font-semibold text-slate-700">{meta}</span>
            </div>
            <ul className="mt-4 space-y-4">
                {parts.map((part) => (
                    <li key={part.name}>
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700">{part.name}</span>
                            <span className="font-semibold text-[#4a8cf0]">{part.count} {t("landingUnitQuestions")}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100">
                            <div className="h-1.5 rounded-full bg-[#4a8cf0]" style={{ width: `${part.count}%` }} />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function getTestKind(test) {
    const questions = test.totalQuestions ?? 200;
    const minutes = test.totalMinutes ?? 120;
    if (questions <= 100 && minutes <= 45) return "listening";
    if (questions <= 100) return "reading";
    return "full";
}

function FeaturedTests() {
    const { t } = useLanguage();
    const [tests, setTests] = useState([]);
    const [status, setStatus] = useState("loading");
    const [errorMessage, setErrorMessage] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        publicApiFetch("/api/tests")
            .then((data) => {
                if (cancelled) return;
                setTests(Array.isArray(data) ? data.slice(0, FEATURED_TEST_LIMIT) : []);
                setStatus("success");
            })
            .catch((error) => {
                if (cancelled) return;
                setErrorMessage(error?.message || "");
                setStatus("error");
            });

        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    const handleRetry = () => {
        setErrorMessage("");
        setStatus("loading");
        setReloadKey((key) => key + 1);
    };

    if (status === "loading") {
        return <LoadingState variant="card" message={t("landingTestsLoading")} />;
    }

    if (status === "error") {
        return (
            <EmptyState
                title={t("landingTestsError")}
                description={errorMessage}
                action={<Button variant="secondary" onClick={handleRetry}>{t("landingTestsRetry")}</Button>}
            />
        );
    }

    if (tests.length === 0) {
        return <EmptyState title={t("landingTestsEmpty")} description={t("landingTestsEmptyDesc")} />;
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tests.map((test) => {
                const kind = getTestKind(test);
                return (
                    <article key={test.testId || test.title} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                        <div className="flex items-center justify-between gap-3">
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${TAG_CLASSES[kind]}`}>
                {t(`landingTag_${kind}`)}
              </span>
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                <Icon name="clock" className="h-3.5 w-3.5" />
                                {test.totalMinutes ?? 120} {t("landingUnitMinutes")}
              </span>
                        </div>
                        <h3 className="mt-3 line-clamp-2 text-base font-bold text-slate-900">{test.title}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                            {test.totalQuestions ?? 200} {t("landingUnitQuestions")}
                        </p>
                        <div className="mt-4">
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
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

function getInitials(name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "");
}

/**
 * Public landing page rendered at "/" for guests (see GuestRoute).
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
                    <span className="inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#3b7fe0]">
                      {t("landingHeroBadge")}
                    </span>
                        <h1 className="mt-5 text-5xl font-extrabold whitespace-pre-line leading-tight tracking-tight text-slate-900 sm:text-6xl">
                            {t("landingHeroTitle")}
                        </h1>
                        <p className="mt-5 max-w-md text-base leading-7 text-slate-600">{t("landingHeroSubtitle")}</p>
                        <div className="mt-7 flex flex-wrap items-center gap-5">
                            <Button to="/login" size="md" className="min-h-11 bg-[#4a8cf0] hover:bg-[#3b7fe0]">
                                {t("landingHeroCtaPrimary")}
                            </Button>
                            <Link to="/support" className="inline-flex items-center gap-2 text-base font-semibold text-slate-800 hover:text-[#2f6fd6]">
                                {t("landingHeroCtaVideo")}
                                <Icon name="play" className="h-3.5 w-3.5" />
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
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-[#4a8cf0]">
                  <Icon name={feature.icon} />
                </span>
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
                        <Link to="/login" className="text-sm font-semibold text-[#2f6fd6] underline underline-offset-2">
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
                            <dd className="order-1 text-5xl font-extrabold text-[#4a8cf0]">{stat.value}</dd>
                            <dt className="order-2 mt-1 text-sm text-slate-600">{t(stat.labelKey)}</dt>
                        </div>
                    ))}
                </dl>
            </section>

            {/* Testimonials */}
            <section className="bg-white">
                <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
                    <SectionHeading label={t("landingReviewsLabel")} title={t("landingReviewsTitle")} />
                    <div className="mt-10 grid gap-4 md:grid-cols-3">
                        {REVIEWS.map((review) => (
                            <figure key={review.name} className="flex flex-col rounded-xl border border-slate-100 bg-white p-5 shadow-md shadow-slate-200/60">
                                <blockquote className="flex-1 text-sm leading-6 text-slate-600">“{t(review.quoteKey)}”</blockquote>
                                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-sky-100 text-sm font-bold text-[#2f6fd6]" aria-hidden="true">
                    {getInitials(review.name)}
                  </span>
                                    <span className="flex flex-col items-start gap-1">
                    <span className="text-sm font-bold text-slate-900">{review.name}</span>
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-600">
                      +{review.gain} {t("landingReviewGainUnit")}
                    </span>
                  </span>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="bg-linear-to-b from-[#2b52d9] to-[#1b2f8f] text-center text-white">
                <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
                    <h2 className="text-4xl font-extrabold tracking-tight">{t("landingCtaTitle")}</h2>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">{t("landingCtaSubtitle")}</p>
                    <Button to="/login" size="md" className="mt-7 bg-[#4a8cf0] hover:bg-[#3b7fe0]">
                        {t("landingCtaButton")}
                    </Button>
                </div>
            </section>
        </div>
    );
}
