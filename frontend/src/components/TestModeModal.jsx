import { useEffect, useState } from "react";
import { EXAM_MODES, TOEIC_PARTS } from "../data/testCatalog";
import { getSuggestedPartDuration } from "../config/examTiming";
import ExamModeCard from "./ExamModeCard";
import { useLanguage } from "../i18n/LanguageContext";

function PartGroup({ title, parts, selectedParts, onToggle }) {
  const { t } = useLanguage();
  return (
    <section>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {parts.map((item) => {
          const selected = selectedParts.includes(item.part);
          return (
            <label
              key={item.part}
              className={`flex cursor-pointer items-center justify-between gap-4 border-b border-slate-100 px-4 py-3.5 transition last:border-b-0 ${
                selected ? "bg-sky-50" : "hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggle(item.part)}
                  className="h-4 w-4 accent-sky-600"
                />
                <span><span className={`block text-sm font-bold ${selected ? "text-sky-700" : "text-slate-800"}`}>{t("part")} {item.part}</span><span className="mt-0.5 block text-xs text-slate-500">{item.label}</span></span>
              </span>
              <span className="text-sm font-medium text-slate-500">{item.questions} {t("questions")}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function TestModeModal({ test, initialTab = "exam", onClose, onStart }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedParts, setSelectedParts] = useState([]);
  const [customTimeEnabled, setCustomTimeEnabled] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [startingKey, setStartingKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !startingKey) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, startingKey]);

  const startMode = async (selection) => {
    const resolvedSelection = {
      ...selection,
      experience: selection.experience || activeTab,
    };
    const key = resolvedSelection.mode === "PART"
      ? `PART-${resolvedSelection.parts.join("-")}`
      : resolvedSelection.mode;
    setStartingKey(key);
    setError("");
    try {
      await onStart(resolvedSelection);
    } catch (requestError) {
      setError(requestError.message || t("unableStartTest"));
      setStartingKey("");
    }
  };

  const listeningParts = TOEIC_PARTS.filter((item) => item.section === "LISTENING");
  const readingParts = TOEIC_PARTS.filter((item) => item.section === "READING");
  const suggestedMinutes = getSuggestedPartDuration(selectedParts) / 60;
  const parsedCustomMinutes = Number(customMinutes);
  const selectedQuestionCount = TOEIC_PARTS
    .filter((item) => selectedParts.includes(item.part))
    .reduce((total, item) => total + item.questions, 0);
  const validCustomTime = !customTimeEnabled
    || (Number.isInteger(parsedCustomMinutes)
      && parsedCustomMinutes >= 1
      && parsedCustomMinutes <= 180);

  const togglePart = (part) => {
    setSelectedParts((current) => current.includes(part)
      ? current.filter((value) => value !== part)
      : [...current, part].sort((left, right) => left - right));
  };

  const toggleCustomTime = () => {
    setCustomTimeEnabled((enabled) => {
      if (!enabled && !customMinutes) {
        setCustomMinutes(String(suggestedMinutes || 1));
      }
      return !enabled;
    });
  };

  const startSelectedParts = (experience = activeTab) => startMode({
    mode: "PART",
    part: selectedParts.length === 1 ? selectedParts[0] : null,
    parts: selectedParts,
    durationMinutes: customTimeEnabled ? parsedCustomMinutes : null,
    experience,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !startingKey) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-mode-title"
        className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-20 flex items-start justify-between gap-5 border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
          <div>
            <p className="hidden text-xs font-bold uppercase tracking-[0.18em] text-sky-600">
              {t("chooseMode")}
            </p>
            <h2 id="test-mode-title" className="text-2xl font-bold text-slate-950">
              {test.title || test.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Chọn chế độ và nội dung bạn muốn luyện</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(startingKey)}
            aria-label={t("closeModeSelection")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          >
            ×
          </button>
        </header>

        <div className="p-5 sm:p-7">
          <div className="inline-flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("exam")}
              className={`border-b-2 px-5 py-2.5 text-sm font-bold transition ${
                activeTab === "exam" ? "border-sky-500 text-sky-600" : "border-transparent text-slate-500"
              }`}
            >
              {t("test")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("practice")}
              className={`border-b-2 px-5 py-2.5 text-sm font-bold transition ${
                activeTab === "practice" ? "border-sky-500 text-sky-600" : "border-transparent text-slate-500"
              }`}
            >
              {t("practice")}
            </button>
          </div>

          <div className={`mt-5 rounded-lg border px-4 py-3 text-sm ${activeTab === "practice" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-sky-200 bg-sky-50 text-sky-800"}`}>
            <strong>{activeTab === "practice" ? "Học theo nhịp của bạn." : "Mô phỏng điều kiện thi thật."}</strong>{" "}
            {activeTab === "practice" ? "Xem đáp án và giải thích ngay, không giới hạn thời gian mặc định." : "Bài làm có tính giờ; Listening chỉ phát một lần và đáp án chỉ hiển thị sau khi nộp."}
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {EXAM_MODES.map((mode) => (
                  <ExamModeCard
                    key={mode.id}
                    mode={mode}
                    experience={activeTab}
                    starting={startingKey === mode.id}
                    disabled={Boolean(startingKey)}
                    onStart={startMode}
                  />
                ))}
              </div>

              <section className="mt-6 border-t border-slate-200 pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-950">
                      {activeTab === "practice" ? t("practiceByPart") : t("testByPart")}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {activeTab === "practice" ? t("practiceDescription") : t("testByPartDescription")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startSelectedParts}
                    disabled={!selectedParts.length || !validCustomTime || Boolean(startingKey)}
                    className="shrink-0 rounded-xl bg-sky-500 px-7 py-3 font-bold text-white shadow-lg shadow-sky-100 transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                  >
                    {startingKey.startsWith("PART-") ? t("preparing") : t("start")}
                  </button>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <PartGroup
                    title={t("listening")}
                    parts={listeningParts}
                    selectedParts={selectedParts}
                    onToggle={togglePart}
                  />
                  <PartGroup
                    title={t("reading")}
                    parts={readingParts}
                    selectedParts={selectedParts}
                    onToggle={togglePart}
                  />
                </div>

                <div className="mt-6 rounded-3xl bg-slate-100 p-5 sm:p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <h4 className="font-bold text-slate-900">{t("testDuration")}</h4>
                      {!customTimeEnabled && selectedParts.length > 0 && activeTab === "exam" && (
                        <p className="mt-3 text-sm text-slate-500">
                          <span className="mr-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 font-bold text-sky-600">
                            {suggestedMinutes} {t("minuteShort")}
                          </span>
                          {t("suggestedTime")}
                        </p>
                      )}
                      {!customTimeEnabled && selectedParts.length > 0 && activeTab === "practice" && (
                        <p className="mt-3 text-sm font-semibold text-emerald-700">
                          {t("untimedPractice")}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={customTimeEnabled}
                      onClick={toggleCustomTime}
                      className="flex items-center gap-3 font-semibold text-slate-600"
                    >
                      {t("customTime")}
                      <span className={`relative h-7 w-12 rounded-full transition ${
                        customTimeEnabled ? "bg-sky-500" : "bg-slate-300"
                      }`}>
                        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                          customTimeEnabled ? "left-6" : "left-1"
                        }`} />
                      </span>
                    </button>
                  </div>

                  {customTimeEnabled && (
                    <label className="mt-5 block max-w-xs">
                      <span className="text-sm font-semibold text-slate-700">{t("minuteRange")}</span>
                      <div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-white px-4 focus-within:border-sky-400 focus-within:ring-4 focus-within:ring-sky-100">
                        <input
                          type="number"
                          min="1"
                          max="180"
                          step="1"
                          value={customMinutes}
                          onChange={(event) => setCustomMinutes(event.target.value)}
                          className="min-w-0 flex-1 bg-transparent py-3 font-bold text-slate-900 outline-none"
                        />
                        <span className="text-sm text-slate-500">{t("minuteShort")}</span>
                      </div>
                      {!validCustomTime && (
                        <span className="mt-2 block text-sm text-red-600">
                          {t("invalidMinutes")}
                        </span>
                      )}
                    </label>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-500">
                  <span className="rounded-full bg-sky-50 px-3 py-2 text-sky-700">
                    {selectedQuestionCount} {t("questions")}
                  </span>
                  <span>{selectedParts.length} {t("partsSelected")}</span>
                </div>
              </section>
          </>
        </div>
      </section>
    </div>
  );
}

export default TestModeModal;
