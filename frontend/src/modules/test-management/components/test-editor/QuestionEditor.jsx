import { useState } from "react";
import AnswerOptionEditor from "./AnswerOptionEditor";
import MediaUploader from "./MediaUploader";

/**
 * QuestionEditor
 *
 * @param {object} question - the question object
 * @param {number} partNumber - TOEIC part number (1 to 7)
 * @param {function(object)} onChange - callback when question changes
 * @param {function()} onDelete - callback to delete question
 * @param {function()} onDuplicate - callback to duplicate question
 */
export default function QuestionEditor({
  question,
  partNumber = 1,
  onChange,
  onDelete,
  onDuplicate,
}) {
  const [showExplanationSection, setShowExplanationSection] = useState(
    Boolean(question.detailedExplanation || question.explanation || question.transcript)
  );

  const updateField = (field, value) => {
    onChange({ ...question, [field]: value });
  };

  const handleCorrectAnswer = (correctLabel) => {
    onChange({ ...question, correctAnswer: correctLabel });
  };

  const handleAnswersChange = (newAnswers) => {
    onChange({ ...question, answers: newAnswers });
  };

  const isPart1 = partNumber === 1;
  const isPart2 = partNumber === 2;
  const isListeningIndividual = isPart1 || isPart2;

  return (
    <div className="space-y-6">
      {/* Question Header Card */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-sm">
            #{question.questionNumber}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Câu hỏi số {question.questionNumber}
            </h3>
            <p className="text-xs text-slate-500">
              Part {partNumber} · TOEIC
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onDuplicate && (
            <button
              type="button"
              onClick={onDuplicate}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              title="Nhân bản câu hỏi"
            >
              📋 Nhân bản
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
              title="Xóa câu hỏi này"
            >
              🗑️ Xóa
            </button>
          )}
        </div>
      </div>

      {/* Part 1 & Part 2 Media (Image and Audio) */}
      {isListeningIndividual && (
        <div className="grid gap-5 md:grid-cols-2">
          {isPart1 && (
            <MediaUploader
              type="image"
              value={question.imageUrl || ""}
              onChange={(url) => updateField("imageUrl", url)}
              label="Ảnh miêu tả (Part 1)"
              placeholder="https://example.com/part1-photo.jpg"
            />
          )}
          <div className={isPart1 ? "" : "md:col-span-2"}>
            <MediaUploader
              type="audio"
              value={question.audioUrl || ""}
              onChange={(url) => updateField("audioUrl", url)}
              label={`Tệp âm thanh câu hỏi ${question.questionNumber}`}
              placeholder="https://example.com/audio-q.mp3"
            />
          </div>
        </div>
      )}

      {/* Question Prompt / Text */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label
          htmlFor={`q-text-${question.questionNumber}`}
          className="mb-2 block text-sm font-bold text-slate-700"
        >
          {isPart1
            ? "Mô tả câu hỏi / Tiêu đề (Part 1 thường là câu mẫu)"
            : isPart2
              ? "Câu hỏi phát trong audio (Part 2)"
              : "Nội dung câu hỏi"}
        </label>
        <textarea
          id={`q-text-${question.questionNumber}`}
          rows={3}
          value={question.question || ""}
          onChange={(e) => updateField("question", e.target.value)}
          placeholder={
            isPart1
              ? "Select the statement that best describes the picture."
              : isPart2
                ? "Where did you leave the meeting agenda?"
                : "VD: The marketing director decided to _______ the launch date by two weeks."
          }
          className="w-full rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />

        <div className="mt-3">
          <label
            htmlFor={`q-trans-${question.questionNumber}`}
            className="mb-1 block text-xs font-semibold text-slate-500"
          >
            Bản dịch câu hỏi (tiếng Việt, hiển thị khi xem giải thích):
          </label>
          <input
            id={`q-trans-${question.questionNumber}`}
            type="text"
            value={question.questionTranslation || question.translation || ""}
            onChange={(e) => {
              onChange({ ...question, questionTranslation: e.target.value, translation: e.target.value });
            }}
            placeholder="Bản dịch tiếng Việt câu hỏi..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-blue-400 focus:bg-white"
          />
        </div>
      </div>

      {/* Answer Options */}
      <AnswerOptionEditor
        answers={question.answers || []}
        correctAnswer={question.correctAnswer || "A"}
        onSelectCorrect={handleCorrectAnswer}
        onChangeAnswers={handleAnswersChange}
        allowThreeOptions={isPart2}
      />

      {/* Toggle Transcript & Detailed Explanations */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <button
          type="button"
          onClick={() => setShowExplanationSection(!showExplanationSection)}
          className="flex w-full items-center justify-between text-left text-sm font-bold text-slate-800"
        >
          <span className="flex items-center gap-2">
            <span className="text-[#2188ee]">💡</span>
            Lời giải chi tiết & Transcript bài nghe
          </span>
          <span className="text-xs font-semibold text-blue-600">
            {showExplanationSection ? "Thu gọn ▲" : "Mở rộng ▼"}
          </span>
        </button>

        {showExplanationSection && (
          <div className="mt-5 space-y-5 border-t border-slate-100 pt-5">
            {/* Transcript (Audio transcript) */}
            {isListeningIndividual && (
              <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/30 p-4">
                <label className="block text-xs font-bold text-blue-900">
                  Transcript bài nghe (Anh - Việt):
                </label>
                <textarea
                  rows={3}
                  value={question.transcript || ""}
                  onChange={(e) => updateField("transcript", e.target.value)}
                  placeholder="Nội dung lời thoại tiếng Anh..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-blue-400"
                />
                <textarea
                  rows={2}
                  value={question.transcriptTranslation || ""}
                  onChange={(e) =>
                    updateField("transcriptTranslation", e.target.value)
                  }
                  placeholder="Dịch nghĩa transcript tiếng Việt..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-blue-400"
                />
              </div>
            )}

            {/* Explanation */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Giải thích đáp án chi tiết (tiếng Anh / ngữ pháp):
              </label>
              <textarea
                rows={3}
                value={question.detailedExplanation ?? question.explanation ?? ""}
                onChange={(e) => {
                  onChange({ ...question, explanation: e.target.value, detailedExplanation: e.target.value });
                }}
                placeholder="Giải thích vì sao chọn đáp án này, phân tích ngữ pháp, từ vựng hoặc dấu hiệu nhận biết..."
                className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Explanation Translation */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Giải thích tiếng Việt (cho người mới học):
              </label>
              <textarea
                rows={2}
                value={question.explanationTranslation || ""}
                onChange={(e) =>
                  updateField("explanationTranslation", e.target.value)
                }
                placeholder="Bản dịch giải thích dễ hiểu tiếng Việt..."
                className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
