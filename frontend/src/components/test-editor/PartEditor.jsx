import { useState, useMemo } from "react";
import QuestionEditor from "./QuestionEditor";
import QuestionGroupEditor from "./QuestionGroupEditor";

const LISTENING_PARTS = [
  { partNumber: 1, name: "Phần 1: Hình ảnh", desc: "Photographs (6 câu)" },
  { partNumber: 2, name: "Phần 2: Hỏi - Đáp", desc: "Question-Response (25 câu)" },
  { partNumber: 3, name: "Phần 3: Hội thoại", desc: "Conversations (39 câu / 13 nhóm)" },
  { partNumber: 4, name: "Phần 4: Bài nói ngắn", desc: "Short Talks (30 câu / 10 nhóm)" },
];

const READING_PARTS = [
  { partNumber: 5, name: "Phần 5: Điền câu", desc: "Incomplete Sentences (30 câu)" },
  { partNumber: 6, name: "Phần 6: Điền đoạn văn", desc: "Text Completion (16 câu / 4 đoạn)" },
  { partNumber: 7, name: "Phần 7: Đọc hiểu", desc: "Reading Comprehension (54 câu)" },
];

/**
 * PartEditor
 *
 * @param {"listening"|"reading"} section - which section to edit
 * @param {Array} parts - list of all parts in test
 * @param {function(Array)} onUpdateParts - callback when any part updates
 * @param {number} [initialPartNumber] - part to focus on initially
 * @param {number} [initialQuestionNumber] - question to focus on initially
 */
export default function PartEditor({
  section = "listening",
  parts = [],
  onUpdateParts,
  initialPartNumber,
  initialQuestionNumber,
}) {
  const availableParts = section === "listening" ? LISTENING_PARTS : READING_PARTS;
  const [activePartNumber, setActivePartNumber] = useState(
    initialPartNumber && availableParts.some((p) => p.partNumber === initialPartNumber)
      ? initialPartNumber
      : availableParts[0].partNumber
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Adjust the active part when the parent passes a new focus target
  // (React docs pattern: adjust state during render instead of an effect).
  const [prevInitialPartNumber, setPrevInitialPartNumber] = useState(initialPartNumber);
  if (initialPartNumber !== prevInitialPartNumber) {
    setPrevInitialPartNumber(initialPartNumber);
    if (initialPartNumber && availableParts.some((p) => p.partNumber === initialPartNumber)) {
      setActivePartNumber(initialPartNumber);
    }
  }

  // Find or create current part
  const currentPart = useMemo(() => {
    const existing = parts.find((p) => p.partNumber === activePartNumber);
    if (existing) return existing;
    return {
      partNumber: activePartNumber,
      name: availableParts.find((p) => p.partNumber === activePartNumber)?.name || `Part ${activePartNumber}`,
      questions: activePartNumber === 1 || activePartNumber === 2 || activePartNumber === 5 ? [] : undefined,
      groups: activePartNumber === 3 || activePartNumber === 4 ? [] : undefined,
      passages: activePartNumber === 6 ? [] : undefined,
      passageGroups: activePartNumber === 7 ? [] : undefined,
    };
  }, [parts, activePartNumber, availableParts]);

  const isIndividualQuestionPart =
    activePartNumber === 1 || activePartNumber === 2 || activePartNumber === 5;
  const isPart3or4 = activePartNumber === 3 || activePartNumber === 4;
  const isPart6 = activePartNumber === 6;
  const isPart7 = activePartNumber === 7;

  // Items to show in left list
  const listItems = useMemo(() => {
    if (isIndividualQuestionPart) {
      return currentPart.questions || [];
    }
    if (isPart3or4) {
      return currentPart.groups || [];
    }
    if (isPart6) {
      return currentPart.passages || [];
    }
    if (isPart7) {
      return currentPart.passageGroups || [];
    }
    return [];
  }, [currentPart, isIndividualQuestionPart, isPart3or4, isPart6, isPart7]);

  // Select the focused question when the focus target or the active part
  // changes (same render-phase adjustment pattern as above).
  const [prevQuestionFocus, setPrevQuestionFocus] = useState({
    questionNumber: initialQuestionNumber,
    partNumber: activePartNumber,
  });
  if (
    prevQuestionFocus.questionNumber !== initialQuestionNumber ||
    prevQuestionFocus.partNumber !== activePartNumber
  ) {
    setPrevQuestionFocus({ questionNumber: initialQuestionNumber, partNumber: activePartNumber });
    if (initialQuestionNumber && listItems.length > 0) {
      const foundIdx = listItems.findIndex((item) => {
        if (item.questionNumber === initialQuestionNumber) return true;
        if (item.questions?.some((q) => q.questionNumber === initialQuestionNumber)) return true;
        return false;
      });
      if (foundIdx >= 0) {
        setSelectedIndex(foundIdx);
      }
    }
  }

  // Update a part in the overall parts array
  const saveUpdatedPart = (updatedPart) => {
    const exists = parts.some((p) => p.partNumber === activePartNumber);
    let nextParts;
    if (exists) {
      nextParts = parts.map((p) => (p.partNumber === activePartNumber ? updatedPart : p));
    } else {
      nextParts = [...parts, updatedPart];
    }
    onUpdateParts(nextParts);
  };

  // Helper to get next question number based on all questions in this and previous parts
  const getNextQuestionNumber = () => {
    let maxNum = 0;
    parts.forEach((p) => {
      (p.questions || []).forEach((q) => {
        if (q.questionNumber > maxNum) maxNum = q.questionNumber;
      });
      (p.groups || []).forEach((g) => {
        (g.questions || []).forEach((q) => {
          if (q.questionNumber > maxNum) maxNum = q.questionNumber;
        });
      });
      (p.passages || []).forEach((pass) => {
        (pass.questions || []).forEach((q) => {
          if (q.questionNumber > maxNum) maxNum = q.questionNumber;
        });
      });
      (p.passageGroups || []).forEach((g) => {
        (g.questions || []).forEach((q) => {
          if (q.questionNumber > maxNum) maxNum = q.questionNumber;
        });
      });
    });

    if (maxNum === 0) {
      // Default starting numbers for standard TOEIC parts
      if (activePartNumber === 1) return 1;
      if (activePartNumber === 2) return 7;
      if (activePartNumber === 3) return 32;
      if (activePartNumber === 4) return 71;
      if (activePartNumber === 5) return 101;
      if (activePartNumber === 6) return 131;
      if (activePartNumber === 7) return 147;
    }
    return maxNum + 1;
  };

  // Add Item (question or group)
  const handleAddItem = () => {
    const nextQNum = getNextQuestionNumber();

    if (isIndividualQuestionPart) {
      const newQuestion = {
        questionNumber: nextQNum,
        question: activePartNumber === 1
          ? "Select the statement that best describes the picture."
          : activePartNumber === 2
            ? "Question text"
            : "Sentence prompt...",
        answers: activePartNumber === 2
          ? [
              { label: "A", content: "" },
              { label: "B", content: "" },
              { label: "C", content: "" },
            ]
          : [
              { label: "A", content: "" },
              { label: "B", content: "" },
              { label: "C", content: "" },
              { label: "D", content: "" },
            ],
        correctAnswer: "A",
        imageUrl: "",
        audioUrl: "",
        transcript: "",
        explanation: "",
      };
      const updated = {
        ...currentPart,
        questions: [...(currentPart.questions || []), newQuestion],
      };
      saveUpdatedPart(updated);
      setSelectedIndex((currentPart.questions || []).length);
    } else if (isPart3or4) {
      const qStart = nextQNum;
      const qEnd = nextQNum + 2;
      const newGroup = {
        questionRange: `${qStart}-${qEnd}`,
        audioUrl: "",
        imageUrl: "",
        transcript: "",
        questions: [
          { questionNumber: qStart, question: "What is the conversation about?", answers: [{ label: "A", content: "" }, { label: "B", content: "" }, { label: "C", content: "" }, { label: "D", content: "" }], correctAnswer: "A" },
          { questionNumber: qStart + 1, question: "What does the woman suggest?", answers: [{ label: "A", content: "" }, { label: "B", content: "" }, { label: "C", content: "" }, { label: "D", content: "" }], correctAnswer: "A" },
          { questionNumber: qEnd, question: "What will the man probably do next?", answers: [{ label: "A", content: "" }, { label: "B", content: "" }, { label: "C", content: "" }, { label: "D", content: "" }], correctAnswer: "A" },
        ],
      };
      const updated = {
        ...currentPart,
        groups: [...(currentPart.groups || []), newGroup],
      };
      saveUpdatedPart(updated);
      setSelectedIndex((currentPart.groups || []).length);
    } else if (isPart6) {
      const pNum = (currentPart.passages || []).length + 1;
      const qStart = nextQNum;
      const newPassage = {
        passageNumber: pNum,
        text: "Questions [131]-[134] refer to the following notice...\n\nNotice content...",
        passages: [{ title: `Đoạn văn ${pNum}`, text: "Questions [131]-[134] refer to the following notice..." }],
        questions: Array.from({ length: 4 }, (_, i) => ({
          questionNumber: qStart + i,
          question: `Question ${qStart + i}`,
          answers: [{ label: "A", content: "" }, { label: "B", content: "" }, { label: "C", content: "" }, { label: "D", content: "" }],
          correctAnswer: "A",
        })),
      };
      const updated = {
        ...currentPart,
        passages: [...(currentPart.passages || []), newPassage],
      };
      saveUpdatedPart(updated);
      setSelectedIndex((currentPart.passages || []).length);
    } else if (isPart7) {
      const gNum = (currentPart.passageGroups || []).length + 1;
      const qStart = nextQNum;
      const newGroup = {
        groupNumber: gNum,
        imageUrls: [],
        passages: [{ title: "Tài liệu 1", text: "Questions 147-148 refer to the following email..." }],
        questions: [
          { questionNumber: qStart, question: "What is the purpose of the email?", answers: [{ label: "A", content: "" }, { label: "B", content: "" }, { label: "C", content: "" }, { label: "D", content: "" }], correctAnswer: "A" },
          { questionNumber: qStart + 1, question: "What is indicated about the sender?", answers: [{ label: "A", content: "" }, { label: "B", content: "" }, { label: "C", content: "" }, { label: "D", content: "" }], correctAnswer: "A" },
        ],
      };
      const updated = {
        ...currentPart,
        passageGroups: [...(currentPart.passageGroups || []), newGroup],
      };
      saveUpdatedPart(updated);
      setSelectedIndex((currentPart.passageGroups || []).length);
    }
  };

  // Delete item at index
  const handleDeleteItem = (indexToDelete) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa mục này?")) return;

    let updated = { ...currentPart };
    if (isIndividualQuestionPart) {
      updated.questions = (currentPart.questions || []).filter((_, i) => i !== indexToDelete);
    } else if (isPart3or4) {
      updated.groups = (currentPart.groups || []).filter((_, i) => i !== indexToDelete);
    } else if (isPart6) {
      updated.passages = (currentPart.passages || []).filter((_, i) => i !== indexToDelete);
    } else if (isPart7) {
      updated.passageGroups = (currentPart.passageGroups || []).filter((_, i) => i !== indexToDelete);
    }
    saveUpdatedPart(updated);
    setSelectedIndex((prev) => Math.max(0, prev - 1));
  };

  // Update single item
  const handleUpdateItem = (updatedItem) => {
    let updated = { ...currentPart };
    if (isIndividualQuestionPart) {
      updated.questions = (currentPart.questions || []).map((item, i) =>
        i === selectedIndex ? updatedItem : item
      );
    } else if (isPart3or4) {
      updated.groups = (currentPart.groups || []).map((item, i) =>
        i === selectedIndex ? updatedItem : item
      );
    } else if (isPart6) {
      updated.passages = (currentPart.passages || []).map((item, i) =>
        i === selectedIndex ? updatedItem : item
      );
    } else if (isPart7) {
      updated.passageGroups = (currentPart.passageGroups || []).map((item, i) =>
        i === selectedIndex ? updatedItem : item
      );
    }
    saveUpdatedPart(updated);
  };

  // Count total questions in current part
  const partQuestionCount = useMemo(() => {
    if (isIndividualQuestionPart) return (currentPart.questions || []).length;
    if (isPart3or4) {
      return (currentPart.groups || []).reduce((acc, g) => acc + (g.questions?.length || 0), 0);
    }
    if (isPart6) {
      return (currentPart.passages || []).reduce((acc, p) => acc + (p.questions?.length || 0), 0);
    }
    if (isPart7) {
      return (currentPart.passageGroups || []).reduce((acc, g) => acc + (g.questions?.length || 0), 0);
    }
    return 0;
  }, [currentPart, isIndividualQuestionPart, isPart3or4, isPart6, isPart7]);

  return (
    <div className="space-y-6">
      {/* Sub-tabs for parts */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {availableParts.map((p) => {
          const isActive = p.partNumber === activePartNumber;
          // Count questions in this part
          const partData = parts.find((item) => item.partNumber === p.partNumber);
          let count = 0;
          if (partData) {
            if (partData.questions) count = partData.questions.length;
            else if (partData.groups) {
              count = partData.groups.reduce((acc, g) => acc + (g.questions?.length || 0), 0);
            } else if (partData.passages) {
              count = partData.passages.reduce((acc, pass) => acc + (pass.questions?.length || 0), 0);
            } else if (partData.passageGroups) {
              count = partData.passageGroups.reduce((acc, g) => acc + (g.questions?.length || 0), 0);
            }
          }

          return (
            <button
              key={p.partNumber}
              type="button"
              onClick={() => {
                setActivePartNumber(p.partNumber);
                setSelectedIndex(0);
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                isActive
                  ? "bg-[#2188ee] text-white shadow-md shadow-blue-200"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>{p.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {count} câu
              </span>
            </button>
          );
        })}
      </div>

      {/* 2-Column Bento Layout (Left List, Right Editor) */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Navigator List */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="border-b border-slate-100 bg-slate-50/70 p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Danh sách câu hỏi
              </h3>
              <p className="text-xs text-slate-500">
                Part {activePartNumber} · {partQuestionCount} câu đã tạo
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs"
            >
              + Thêm mới
            </button>
          </div>

          <div className="max-h-[580px] overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {listItems.length === 0 ? (
              <div className="py-12 text-center">
                <span className="text-3xl">📝</span>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  Chưa có câu hỏi nào trong Part {activePartNumber}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Nhấn "Thêm mới" để bắt đầu soạn câu hỏi.
                </p>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="mt-4 inline-flex items-center gap-1 rounded-xl bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                >
                  + Tạo câu hỏi đầu tiên
                </button>
              </div>
            ) : (
              listItems.map((item, index) => {
                const isSelected = index === selectedIndex;
                let title = `Câu ${index + 1}`;
                let subtitle = "";

                if (isIndividualQuestionPart) {
                  title = `Câu hỏi #${item.questionNumber}`;
                  subtitle = item.question ? item.question.slice(0, 32) + "..." : "Chưa có nội dung";
                } else if (isPart3or4) {
                  title = `Nhóm ${item.questionRange || index + 1}`;
                  subtitle = `${item.questions?.length || 0} câu hỏi con`;
                } else if (isPart6) {
                  title = `Đoạn văn ${item.passageNumber || index + 1}`;
                  subtitle = `${item.questions?.length || 0} câu hỏi con`;
                } else if (isPart7) {
                  title = `Bài đọc ${item.groupNumber || index + 1}`;
                  subtitle = `${item.questions?.length || 0} câu hỏi con`;
                }

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedIndex(index)}
                    className={`flex cursor-pointer items-center justify-between rounded-xl p-3 transition-all ${
                      isSelected
                        ? "bg-blue-50/80 border border-blue-200 text-blue-900 shadow-xs"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">
                          {title}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {subtitle}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(index);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Xóa"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Editor Workspace */}
        <div className="lg:col-span-8">
          {listItems[selectedIndex] ? (
            isIndividualQuestionPart ? (
              <QuestionEditor
                key={`${activePartNumber}-${selectedIndex}`}
                question={listItems[selectedIndex]}
                partNumber={activePartNumber}
                onChange={handleUpdateItem}
                onDelete={() => handleDeleteItem(selectedIndex)}
              />
            ) : (
              <QuestionGroupEditor
                key={`${activePartNumber}-${selectedIndex}`}
                group={listItems[selectedIndex]}
                partNumber={activePartNumber}
                onChange={handleUpdateItem}
                onDelete={() => handleDeleteItem(selectedIndex)}
              />
            )
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <span className="text-4xl">🎯</span>
              <h3 className="mt-4 text-base font-bold text-slate-800">
                Chưa chọn câu hỏi để chỉnh sửa
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Hãy chọn một câu hỏi ở danh sách bên trái hoặc nhấn "+ Thêm mới".
              </p>
              <button
                type="button"
                onClick={handleAddItem}
                className="mt-5 rounded-xl bg-[#2188ee] px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-600 shadow-md shadow-blue-200"
              >
                + Thêm câu hỏi ngay
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
