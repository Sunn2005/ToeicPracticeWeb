import { useRef, useState } from "react";
import StaffDialog from "../../../staff-management/components/StaffDialog";
import { useLanguage } from "../../../../i18n/LanguageContext";
import { buildTemplateCsv, buildTestFromCsv } from "../../utils/csvImport";

const EXPECTED_COUNTS = { 1: 6, 2: 25, 3: 39, 4: 30, 5: 30, 6: 16, 7: 54 };
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * CsvImportDialog — pick a CSV file in the team template, validate it row by
 * row, and (only when fully valid) load the built test into the editor as an
 * unsaved draft. Nothing is saved or submitted from here.
 *
 * @param {function(object)} onImport - called with the built test object
 * @param {function()} onClose
 */
export default function CsvImportDialog({ onImport, onClose }) {
  const { t } = useLanguage();
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState(null);
  const [title, setTitle] = useState("");
  const [localError, setLocalError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const format = (key, values = {}) =>
    t(key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");

  const handleFile = async (file) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setLocalError(t("employeeImportFileTypeError"));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setLocalError(t("employeeImportFileTooLarge"));
      return;
    }
    setLocalError("");
    const text = await file.text();
    const parsed = buildTestFromCsv(text);
    setResult(parsed);
    setFileName(file.name);
    setTitle(parsed.suggestedTitle || "");
  };

  const reset = () => {
    setResult(null);
    setFileName("");
    setTitle("");
    setLocalError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = () => {
    const blob = new Blob([buildTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mau-import-de.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const errorRows = result
    ? new Set(result.issues.filter((issue) => issue.row > 0).map((issue) => issue.row))
    : new Set();
  const validCount = result ? result.stats.rowCount - errorRows.size : 0;
  const isValid = Boolean(result) && result.issues.length === 0;

  return (
    <StaffDialog title={t("employeeImportTitle")} onClose={onClose}>
      <div className="space-y-5 p-6">
        {!result && (
          <>
            <div
              onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                handleFile(event.dataTransfer.files?.[0]);
              }}
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
                dragOver ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-slate-50"
              }`}
            >
              <div className="text-4xl">📥</div>
              <p className="mt-3 text-sm font-bold text-slate-800">{t("employeeImportPickTitle")}</p>
              <p className="mt-1 text-xs text-slate-500">{t("employeeImportPickHint")}</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl bg-[#2188ee] px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-600"
                >
                  {t("employeeImportChooseFile")}
                </button>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  {t("employeeImportSample")}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-slate-500">
              <li>{t("employeeImportReqFormat")}</li>
              <li>{t("employeeImportReqMedia")}</li>
              <li>{t("employeeImportReqDraft")}</li>
            </ul>
            {localError && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {localError}
              </p>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                {t("employeeImportCancel")}
              </button>
            </div>
          </>
        )}

        {result && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-bold text-slate-800">📄 {fileName}</span>
              <span className="text-slate-500">
                {format("employeeImportFileStats", { rows: result.stats.rowCount })}
              </span>
            </div>

            {!isValid && (
              <>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  {format("employeeImportErrorsSummary", {
                    valid: validCount,
                    total: result.stats.rowCount,
                    errors: result.issues.length,
                  })}
                </div>
                <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {result.issues.map((issue, index) => (
                    <li
                      key={`${issue.code}-${index}`}
                      className="rounded-xl border border-red-100 bg-white p-3 text-xs leading-5 text-slate-700"
                    >
                      {issue.row > 0 && (
                        <span className="mr-2 font-bold text-red-700">
                          {t("employeeImportRow")} {issue.row}
                        </span>
                      )}
                      {format(issue.code, issue.values)}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500">{t("employeeImportErrorsBlocked")}</p>
              </>
            )}

            {isValid && (
              <>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  {format("employeeImportValidSummary", {
                    rows: result.stats.rowCount,
                    audio: result.stats.audioCount,
                    images: result.stats.imageCount,
                  })}
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
                  {[1, 2, 3, 4, 5, 6, 7].map((part) => (
                    <div key={part} className="flex items-center justify-between border-b border-slate-100 py-1">
                      <span className="font-medium text-slate-600">Part {part}</span>
                      <span className="font-mono font-bold text-slate-900">
                        {result.stats.partCounts[part]} / {EXPECTED_COUNTS[part]} ✓
                      </span>
                    </div>
                  ))}
                </div>
                {result.stats.ignoredAnswerTranslation && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                    {t("employeeImportAnswerTranslationNote")}
                  </p>
                )}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-700">
                    {t("employeeImportTitleLabel")}
                  </span>
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={t("employeeImportTitlePlaceholder")}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">
                    {t("employeeImportTitleHint")}
                  </span>
                </label>
              </>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={reset}
                className="min-h-11 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                {t("employeeImportReselect")}
              </button>
              <button
                type="button"
                disabled={!isValid}
                onClick={() => onImport({ ...result.test, title: title.trim() || result.test.title })}
                className="min-h-11 rounded-xl bg-[#2188ee] px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("employeeImportLoadButton")}
              </button>
            </div>
          </>
        )}
      </div>
    </StaffDialog>
  );
}
