import { useState } from "react";
import MediaUploader from "./MediaUploader";
import QuestionEditor from "./QuestionEditor";
import PassageEditor from "./PassageEditor";

/**
 * QuestionGroupEditor
 *
 * @param {object} group - group data
 * @param {number} partNumber - TOEIC part number (3, 4, 6, 7)
 * @param {function(object)} onChange - callback when group changes
 * @param {function()} onDelete - callback to delete group
 */
export default function QuestionGroupEditor({
  group,
  partNumber = 3,
  onChange,
  onDelete,
}) {
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  const updateGroupField = (field, value) => {
    onChange({ ...group, [field]: value });
  };

  const isListeningGroup = partNumber === 3 || partNumber === 4;
  const isReadingGroup = partNumber === 6 || partNumber === 7;

  const questions = group.questions || [];

  const handleQuestionChange = (qIndex, updatedQuestion) => {
    const nextQuestions = questions.map((q, idx) =>
      idx === qIndex ? updatedQuestion : q
    );
    onChange({ ...group, questions: nextQuestions });
  };

  const handleAddQuestion = () => {
    const lastNum = questions[questions.length - 1]?.questionNumber || 0;
    const newQuestion = {
      questionNumber: lastNum + 1,
      question: "Select the best answer.",
      answers: [
        { label: "A", content: "" },
        { label: "B", content: "" },
        { label: "C", content: "" },
        { label: "D", content: "" },
      ],
      correctAnswer: "A",
      explanation: "",
    };
    const nextQuestions = [...questions, newQuestion];
    const newRange = `${nextQuestions[0]?.questionNumber}-${nextQuestions.at(-1)?.questionNumber}`;
    onChange({
      ...group,
      questions: nextQuestions,
      questionRange: newRange,
    });
    setActiveQuestionIndex(nextQuestions.length - 1);
  };

  const handleDeleteQuestion = (qIndex) => {
    if (questions.length <= 1) {
      alert("Mỗi nhóm phải có ít nhất 1 câu hỏi.");
      return;
    }
    const nextQuestions = questions.filter((_, idx) => idx !== qIndex);
    const newRange = `${nextQuestions[0]?.questionNumber}-${nextQuestions.at(-1)?.questionNumber}`;
    onChange({
      ...group,
      questions: nextQuestions,
      questionRange: newRange,
    });
    setActiveQuestionIndex((prev) => Math.max(0, Math.min(prev, nextQuestions.length - 1)));
  };

  return (
    <div className="space-y-6">
      {/* Group Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">
                Part {partNumber} Group
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                {isListeningGroup
                  ? `Nhóm câu hỏi: ${group.questionRange || "Mới"}`
                  : `Bài đọc số ${group.groupNumber || group.passageNumber || 1}`}
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Chứa {questions.length} câu hỏi con trong nhóm này.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isListeningGroup && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Dải câu:</label>
                <input
                  type="text"
                  value={group.questionRange || ""}
                  onChange={(e) => updateGroupField("questionRange", e.target.value)}
                  placeholder="VD: 32-34"
                  className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-400"
                />
              </div>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition"
              >
                Xóa nhóm
              </button>
            )}
          </div>
        </div>

        {/* Media for Part 3 & Part 4 (Listening Group) */}
        {isListeningGroup && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <MediaUploader
                type="audio"
                value={group.audioUrl || ""}
                onChange={(url) => updateGroupField("audioUrl", url)}
                label={`Âm thanh đoạn hội thoại/bài nói (${group.questionRange})`}
                placeholder="https://example.com/audio-group.mp3"
              />
              <MediaUploader
                type="image"
                value={group.imageUrl || ""}
                onChange={(url) => updateGroupField("imageUrl", url)}
                label="Hình ảnh bảng biểu/sơ đồ đính kèm (nếu có)"
                placeholder="https://example.com/graphic.png"
              />
            </div>

            {/* Transcript */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <label className="block text-xs font-bold text-slate-700">
                Transcript đoạn hội thoại / bài nói:
              </label>
              <textarea
                rows={3}
                value={group.transcript || ""}
                onChange={(e) => updateGroupField("transcript", e.target.value)}
                placeholder="Nhập lời thoại tiếng Anh của đoạn hội thoại hoặc bài nói..."
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-blue-400"
              />
              <textarea
                rows={2}
                value={group.transcriptTranslation || ""}
                onChange={(e) => updateGroupField("transcriptTranslation", e.target.value)}
                placeholder="Bản dịch tiếng Việt tham khảo..."
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-blue-400"
              />
            </div>
          </div>
        )}

        {/* Passage for Part 6 & Part 7 (Reading Group) */}
        {isReadingGroup && (
          <PassageEditor
            passages={partNumber === 6 ? [group] : group.passages || []}
            imageUrls={partNumber === 6 ? (group.imageUrl ? [group.imageUrl] : []) : group.imageUrls || []}
            onChangePassages={(newPassages) => {
              onChange(partNumber === 6
                ? { ...group, ...newPassages[0] }
                : { ...group, passages: newPassages });
            }}
            onChangeImageUrls={(newImages) => onChange(partNumber === 6
              ? { ...group, imageUrl: newImages.at(-1) || "" }
              : { ...group, imageUrls: newImages })}
            showMultiplePassages={partNumber === 7}
          />
        )}
      </div>

      {/* Sub-questions selector and editor */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-800">
              Các câu hỏi con trong nhóm:
            </span>
            <div className="flex gap-1.5">
              {questions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveQuestionIndex(idx)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                    idx === activeQuestionIndex
                      ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-200"
                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {q.questionNumber || idx + 1}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddQuestion}
            className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
          >
            + Thêm câu hỏi vào nhóm
          </button>
        </div>

        {questions[activeQuestionIndex] ? (
          <QuestionEditor
            key={activeQuestionIndex}
            question={questions[activeQuestionIndex]}
            partNumber={partNumber}
            onChange={(updated) => handleQuestionChange(activeQuestionIndex, updated)}
            onDelete={() => handleDeleteQuestion(activeQuestionIndex)}
          />
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">
            Chưa có câu hỏi nào trong nhóm này.
          </p>
        )}
      </div>
    </div>
  );
}
