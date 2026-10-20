// Đếm tổng số câu của một Part (câu lẻ + câu trong groups/passages/passageGroups).
function countPartQuestions(part) {
  if (!part) return 0;
  let total = Array.isArray(part.questions) ? part.questions.length : 0;
  ["groups", "passages", "passageGroups"].forEach((key) => {
    (part[key] || []).forEach((block) => {
      if (Array.isArray(block.questions)) total += block.questions.length;
    });
  });
  return total;
}

function QuestionCard({ question }) {
  if (!question) return null;
  const answers = Array.isArray(question.answers) ? question.answers : [];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="text-sm font-bold text-slate-900">
        Câu {question.questionNumber ?? "—"}
      </p>

      {question.imageUrl && (
        <img
          src={question.imageUrl}
          alt={`Hình minh họa câu ${question.questionNumber ?? ""}`}
          loading="lazy"
          className="mt-3 max-h-64 rounded-lg border border-slate-200 object-contain"
        />
      )}

      {question.audioUrl && (
        <audio controls preload="none" src={question.audioUrl} className="mt-3 w-full">
          Trình duyệt của bạn không hỗ trợ phát audio.
        </audio>
      )}

      {question.question && (
        <p className="mt-3 text-sm leading-6 text-slate-800">{question.question}</p>
      )}

      {answers.length > 0 && (
        <ul className="mt-3 space-y-2">
          {answers.map((answer) => {
            const isCorrect = answer.label === question.correctAnswer;
            return (
              <li
                key={answer.label}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                  isCorrect
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-slate-50/50"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCorrect ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {answer.label}
                </span>
                <span className="flex-1 text-slate-700">{answer.content}</span>
                {isCorrect && (
                  <span className="shrink-0 rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                    Đáp án đúng
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {(question.transcript || question.questionTranslation || question.answerTranslation || question.detailedExplanation) && (
        <details className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
          <summary className="cursor-pointer font-semibold text-[#2188ee]">
            Xem giải thích &amp; bản dịch
          </summary>
          <div className="mt-2 space-y-2 text-slate-600">
            {question.transcript && (
              <p><strong className="text-slate-800">Transcript:</strong> {question.transcript}</p>
            )}
            {question.questionTranslation && (
              <p><strong className="text-slate-800">Dịch câu hỏi:</strong> {question.questionTranslation}</p>
            )}
            {question.answerTranslation && (
              <p><strong className="text-slate-800">Dịch đáp án:</strong> {question.answerTranslation}</p>
            )}
            {question.detailedExplanation && (
              <p><strong className="text-slate-800">Giải thích chi tiết:</strong> {question.detailedExplanation}</p>
            )}
          </div>
        </details>
      )}
    </article>
  );
}

// Khối câu hỏi chung (Part 3/4/6/7): có thể mang audio/ảnh/passage dùng chung,
// rồi mới tới các câu hỏi con bên trong.
function QuestionBlock({ block }) {
  if (!block) return null;
  const questions = Array.isArray(block.questions) ? block.questions : [];
  return (
    <div className="space-y-4">
      {(block.title || block.content) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          {block.title && <p className="font-bold text-slate-900">{block.title}</p>}
          {block.content && <p className="mt-1 whitespace-pre-line">{block.content}</p>}
        </div>
      )}
      {block.imageUrl && (
        <img
          src={block.imageUrl}
          alt="Hình minh họa nhóm câu hỏi"
          loading="lazy"
          className="max-h-64 rounded-lg border border-slate-200 object-contain"
        />
      )}
      {Array.isArray(block.imageUrls) && block.imageUrls.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {block.imageUrls.map((url) => (
            <img
              key={url}
              src={url}
              alt="Hình minh họa nhóm câu hỏi"
              loading="lazy"
              className="max-h-48 rounded-lg border border-slate-200 object-contain"
            />
          ))}
        </div>
      )}
      {block.audioUrl && (
        <audio controls preload="none" src={block.audioUrl} className="w-full">
          Trình duyệt của bạn không hỗ trợ phát audio.
        </audio>
      )}
      {block.transcript && (
        <details className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
          <summary className="cursor-pointer font-semibold text-[#2188ee]">Xem transcript</summary>
          <p className="mt-2 whitespace-pre-line text-slate-600">{block.transcript}</p>
        </details>
      )}
      {questions.map((question, index) => (
        <QuestionCard key={question.questionNumber ?? `q-${index}`} question={question} />
      ))}
    </div>
  );
}

function PartSection({ part, hasError }) {
  const directQuestions = Array.isArray(part.questions) ? part.questions : [];
  const blocks = ["groups", "passages", "passageGroups"].flatMap((key) =>
    Array.isArray(part[key]) ? part[key] : [],
  );

  return (
    <section id={`part-${part.partNumber}`} aria-label={`Part ${part.partNumber}`} className="scroll-mt-24">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-bold text-slate-950">
          Part {part.partNumber}{part.name ? ` — ${part.name}` : ""}
        </h3>
        {hasError && (
          <span aria-label="Part này có lỗi nhập liệu" title="Part này có lỗi nhập liệu" className="h-2.5 w-2.5 rounded-full bg-red-500" />
        )}
        <span className="ml-auto rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
          {countPartQuestions(part)} câu
        </span>
      </div>
      <div className="mt-4 space-y-4">
        {directQuestions.map((question, index) => (
          <QuestionCard key={question.questionNumber ?? `q-${index}`} question={question} />
        ))}
        {blocks.map((block, index) => (
          <QuestionBlock key={block.groupNumber ?? block.passageNumber ?? index} block={block} />
        ))}
        {directQuestions.length === 0 && blocks.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            Part này chưa có câu hỏi.
          </p>
        )}
      </div>
    </section>
  );
}

// Preview nội dung đề thật cho admin xem xét trước khi duyệt (Figma frame 7):
// cột "DANH SÁCH PHẦN THI" (Part 1-7 kèm số câu, bấm để nhảy tới Part) +
// nội dung từng câu hỏi (ảnh, audio, đáp án đúng tô xanh lá, giải thích/bản dịch).
//
// Vì sao tách component này ra khỏi TestReviewPage:
// - Trang chi tiết trước đây chỉ hiện metadata, admin không thấy được nội
//   dung đề thật để review — đây là thiếu sót lớn nhất của trang hiện tại.
// - Tách ra để sau này trang Review History Detail dùng lại được.
//
// Cách dùng: <SubmissionPreview test={test} errorPartNumbers={new Set()} />
// - test: object Test đầy đủ từ getSubmission(), cần field parts.
// - errorPartNumbers: Set các partNumber đang có lỗi validation — Part đó
//   sẽ có chấm đỏ (Figma frame 8).
function SubmissionPreview({ test, errorPartNumbers = new Set() }) {
  const parts = Array.isArray(test?.parts) ? test.parts : [];

  if (parts.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
        Đề thi chưa có nội dung các Part.
      </p>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-[280px_minmax(0,1fr)]">
      {/* Cột danh sách Part */}
      <nav aria-label="Danh sách phần thi" className="md:sticky md:top-6 md:self-start">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="px-2 text-xs font-bold tracking-wide text-slate-500">
            DANH SÁCH PHẦN THI
          </h2>
          <ul className="mt-3 space-y-1">
            {parts.map((part) => (
              <li key={part.partNumber}>
                <a
                  href={`#part-${part.partNumber}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#2188ee]"
                >
                  {errorPartNumbers.has(part.partNumber) && (
                    <span aria-label="Part này có lỗi nhập liệu" className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  )}
                  <span className="flex-1">Part {part.partNumber}</span>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-500">
                    {countPartQuestions(part)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Nội dung các Part */}
      <div className="min-w-0 space-y-10">
        {parts.map((part) => (
          <PartSection
            key={part.partNumber}
            part={part}
            hasError={errorPartNumbers.has(part.partNumber)}
          />
        ))}
      </div>
    </div>
  );
}

export default SubmissionPreview;