
/**
 * TestMetadataForm (Wizard Step 1: Thông tin đề thi)
 *
 * @param {object} form - current form values
 * @param {function(object)} onChange - handler when form fields change
 */
export default function TestMetadataForm({ form, onChange }) {
  const updateField = (field, value) => {
    onChange({ ...form, [field]: value });
  };

  const handleTypeChange = (newType) => {
    if (newType === "FULL_TEST") {
      onChange({
        ...form,
        type: newType,
        totalQuestions: 200,
        listeningMinutes: 45,
        readingMinutes: 75,
        totalMinutes: 120,
      });
    } else {
      onChange({
        ...form,
        type: newType,
      });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="border-b border-slate-100 pb-5 mb-6">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Thông tin đề thi
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Xác định các thông số cốt lõi và chi tiết mô tả cho bài đánh giá mới của bạn.
          </p>
        </div>

        <div className="space-y-6">
          {/* Tên đề thi */}
          <div>
            <label
              htmlFor="title"
              className="mb-2 block text-sm font-bold text-slate-700"
            >
              Tên đề thi <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              value={form.title || ""}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="VD: ETS TOEIC 2024 Test 05 — Full Assessment"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {/* Mô tả */}
          <div>
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-bold text-slate-700"
            >
              Mô tả đề thi
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={form.description || ""}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Mô tả ngắn gọn mục đích, đối tượng và phạm vi của bài kiểm tra này..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {/* Loại đề & Độ khó */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="type"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Loại đề thi
              </label>
              <select
                id="type"
                name="type"
                value={form.type || "FULL_TEST"}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="FULL_TEST">Full Test (200 câu - 120 phút)</option>
                <option value="PRACTICE">Mini Test / Luyện tập từng phần</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="difficulty"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Mức độ khó
              </label>
              <select
                id="difficulty"
                name="difficulty"
                value={form.difficulty || "intermediate"}
                onChange={(e) => updateField("difficulty", e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="beginner">Cơ bản (350 - 550 điểm)</option>
                <option value="intermediate">Trung cấp (550 - 750 điểm)</option>
                <option value="advanced">Nâng cao (750 - 990 điểm)</option>
                <option value="standard">Tiêu chuẩn chuẩn ETS</option>
              </select>
            </div>
          </div>

          {/* Số lượng câu hỏi & Thời gian */}
          <div className="grid gap-5 sm:grid-cols-4">
            <div>
              <label
                htmlFor="totalQuestions"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Tổng số câu
              </label>
              <input
                id="totalQuestions"
                name="totalQuestions"
                type="number"
                min="1"
                value={form.totalQuestions ?? 200}
                onChange={(e) =>
                  updateField("totalQuestions", Number(e.target.value) || 0)
                }
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="listeningMinutes"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Nghe (phút)
              </label>
              <input
                id="listeningMinutes"
                name="listeningMinutes"
                type="number"
                min="1"
                value={form.listeningMinutes ?? 45}
                onChange={(e) => {
                  const listening = Number(e.target.value) || 0;
                  const reading = Number(form.readingMinutes) || 0;
                  onChange({
                    ...form,
                    listeningMinutes: listening,
                    totalMinutes: listening + reading,
                  });
                }}
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="readingMinutes"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Đọc (phút)
              </label>
              <input
                id="readingMinutes"
                name="readingMinutes"
                type="number"
                min="1"
                value={form.readingMinutes ?? 75}
                onChange={(e) => {
                  const reading = Number(e.target.value) || 0;
                  const listening = Number(form.listeningMinutes) || 0;
                  onChange({
                    ...form,
                    readingMinutes: reading,
                    totalMinutes: listening + reading,
                  });
                }}
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="totalMinutes"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Tổng giờ (phút)
              </label>
              <input
                id="totalMinutes"
                name="totalMinutes"
                type="number"
                min="1"
                value={form.totalMinutes ?? 120}
                onChange={(e) =>
                  updateField("totalMinutes", Number(e.target.value) || 0)
                }
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-blue-700 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contextual Helper Note Box (from Stitch design) */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-xs">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow-sm">
          ℹ
        </span>
        <div className="text-sm leading-relaxed text-blue-950">
          <p className="font-bold">Lưu ý khi tạo đề thi:</p>
          <p className="text-blue-800">
            Thông tin đề thi sẽ hiển thị trong thư viện bài thi và trên giao diện phòng thi của học viên.
            Bạn có thể chỉnh sửa và lưu nháp bất cứ lúc nào trước khi gửi duyệt.
          </p>
        </div>
      </div>
    </div>
  );
}
