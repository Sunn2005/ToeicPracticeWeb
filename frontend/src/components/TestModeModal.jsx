import { useEffect, useState } from "react";
import { EXAM_MODES, TOEIC_PARTS } from "../data/testCatalog";
import ExamModeCard from "./ExamModeCard";

function PartGroup({ title, parts, selectedPart, onSelect }) {
  return (
    <section>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {parts.map((item) => {
          const selected = selectedPart === item.part;
          return (
            <label
              key={item.part}
              className={`flex cursor-pointer items-center justify-between gap-4 border-b border-slate-100 px-4 py-3.5 transition last:border-b-0 ${
                selected ? "bg-sky-50" : "hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="toeic-part"
                  checked={selected}
                  onChange={() => onSelect(item.part)}
                  className="h-4 w-4 accent-sky-600"
                />
                <span className={`text-sm font-bold ${selected ? "text-sky-700" : "text-slate-800"}`}>
                  Part {item.part}
                </span>
              </span>
              <span className="text-sm font-medium text-slate-500">{item.questions} câu</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function TestModeModal({ test, onClose, onStart }) {
  const [activeTab, setActiveTab] = useState("exam");
  const [selectedPart, setSelectedPart] = useState(null);
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
    const key = selection.mode === "PART" ? `PART-${selection.part}` : selection.mode;
    setStartingKey(key);
    setError("");
    try {
      await onStart(selection);
    } catch (requestError) {
      setError(requestError.message || "Không thể bắt đầu bài thi.");
      setStartingKey("");
    }
  };

  const listeningParts = TOEIC_PARTS.filter((item) => item.section === "LISTENING");
  const readingParts = TOEIC_PARTS.filter((item) => item.section === "READING");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !startingKey) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-mode-title"
        className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-slate-50 shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-slate-200 bg-white/95 px-5 py-5 backdrop-blur-xl sm:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">
              Chọn chế độ
            </p>
            <h2 id="test-mode-title" className="mt-1 text-2xl font-bold text-slate-950">
              {test.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">ETS {test.year} · {test.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(startingKey)}
            aria-label="Đóng cửa sổ chọn chế độ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          >
            ×
          </button>
        </header>

        <div className="p-5 sm:p-8">
          <div className="inline-flex rounded-xl bg-slate-200/70 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("exam")}
              className={`rounded-lg px-5 py-2.5 text-sm font-bold transition ${
                activeTab === "exam" ? "bg-white text-sky-700 shadow-sm" : "text-slate-500"
              }`}
            >
              Luyện thi
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("practice")}
              className={`rounded-lg px-5 py-2.5 text-sm font-bold transition ${
                activeTab === "practice" ? "bg-white text-slate-700 shadow-sm" : "text-slate-500"
              }`}
            >
              Luyện tập
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                Sắp phát triển
              </span>
            </button>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {activeTab === "practice" ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-xl font-black text-amber-700">
                P
              </span>
              <h3 className="mt-4 text-xl font-bold text-slate-900">Chế độ Luyện tập đang được phát triển</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Hiện tại bạn có thể sử dụng đầy đủ các chế độ trong tab Luyện thi.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {EXAM_MODES.map((mode) => (
                  <ExamModeCard
                    key={mode.id}
                    mode={mode}
                    starting={startingKey === mode.id}
                    disabled={Boolean(startingKey)}
                    onStart={startMode}
                  />
                ))}
              </div>

              <section className="mt-8 border-t border-slate-200 pt-7">
                <div>
                  <h3 className="text-xl font-bold text-slate-950">Thi theo Part</h3>
                  <p className="mt-1 text-sm text-slate-500">Chọn Part cụ thể để thi thử</p>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <PartGroup
                    title="Listening"
                    parts={listeningParts}
                    selectedPart={selectedPart}
                    onSelect={setSelectedPart}
                  />
                  <PartGroup
                    title="Reading"
                    parts={readingParts}
                    selectedPart={selectedPart}
                    onSelect={setSelectedPart}
                  />
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => startMode({ mode: "PART", part: selectedPart })}
                    disabled={!selectedPart || Boolean(startingKey)}
                    className="w-full rounded-xl bg-sky-500 px-7 py-3.5 font-bold text-white shadow-lg shadow-sky-100 transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:w-auto"
                  >
                    {startingKey.startsWith("PART-") ? "Đang chuẩn bị..." : "Bắt đầu Part đã chọn"}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default TestModeModal;
