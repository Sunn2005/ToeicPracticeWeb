import MediaUploader from "./MediaUploader";

/**
 * PassageEditor
 *
 * @param {Array<{title?: string, content?: string}>} passages - list of passages
 * @param {Array<string>} imageUrls - image URLs for graphical reading passages (receipts, brochures, etc.)
 * @param {function(Array)} onChangePassages - callback when passages change
 * @param {function(Array<string>)} onChangeImageUrls - callback when images change
 * @param {boolean} showMultiplePassages - whether to allow adding multiple sub-passages (Part 7 double/triple)
 */
export default function PassageEditor({
  passages = [],
  imageUrls = [],
  onChangePassages,
  onChangeImageUrls,
  showMultiplePassages = false,
}) {
  const safePassages = passages.length > 0 ? passages : [{ title: "", content: "" }];

  const handlePassageTextChange = (index, field, value) => {
    const next = safePassages.map((p, i) => (i === index ? { ...p, [field]: value } : p));
    onChangePassages(next);
  };

  const handleAddPassage = () => {
    onChangePassages([...safePassages, { title: `Đoạn văn ${safePassages.length + 1}`, content: "" }]);
  };

  const handleRemovePassage = (index) => {
    if (safePassages.length <= 1) return;
    onChangePassages(safePassages.filter((_, i) => i !== index));
  };

  const handleAddImage = (url) => {
    if (!url) return;
    onChangeImageUrls?.([...(imageUrls || []), url]);
  };

  const handleRemoveImage = (index) => {
    onChangeImageUrls?.((imageUrls || []).filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Nội dung bài đọc (Passage)
          </h3>
          <p className="text-xs text-slate-500">
            Nhập văn bản bài đọc hoặc đính kèm ảnh tài liệu (email, thông báo, hóa đơn...)
          </p>
        </div>
        {showMultiplePassages && (
          <button
            type="button"
            onClick={handleAddPassage}
            className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
          >
            + Thêm đoạn văn thứ {safePassages.length + 1}
          </button>
        )}
      </div>

      {/* List of Passages */}
      {safePassages.map((passage, index) => (
        <div
          key={index}
          className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {showMultiplePassages
                ? `Đoạn ${index + 1}: ${passage.title || "Văn bản đọc"}`
                : "Văn bản bài đọc"}
            </span>
            {showMultiplePassages && safePassages.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemovePassage(index)}
                className="text-xs font-bold text-red-500 hover:text-red-700"
              >
                Xóa đoạn này
              </button>
            )}
          </div>

          {showMultiplePassages && (
            <input
              type="text"
              value={passage.title || ""}
              onChange={(e) => handlePassageTextChange(index, "title", e.target.value)}
              placeholder="Tiêu đề loại bài (VD: Email, Notice, Schedule, Article)..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-400"
            />
          )}

          <div>
            <textarea
              rows={8}
              value={passage.content || ""}
              onChange={(e) => handlePassageTextChange(index, "content", e.target.value)}
              placeholder="Dán hoặc soạn nội dung bài đọc ở đây. Trong Part 6 có thể ghi các vị trí trống như [131], [132]..."
              className="w-full rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm leading-relaxed text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </div>
      ))}

      {/* Part 7 Document Images */}
      {onChangeImageUrls && (
        <div className="pt-2">
          <label className="mb-2 block text-xs font-bold text-slate-700">
            Hình ảnh tài liệu đính kèm (nếu bài đọc là biểu đồ, bảng biểu hoặc ảnh chụp scan):
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {(imageUrls || []).map((imgUrl, imgIdx) => (
              <div
                key={imgIdx}
                className="relative rounded-xl border border-slate-200 bg-white p-2 shadow-xs"
              >
                <img
                  src={imgUrl}
                  alt={`Tài liệu ${imgIdx + 1}`}
                  className="h-36 w-full object-contain rounded-lg bg-slate-50"
                  onError={(e) => {
                    e.currentTarget.src = "https://placehold.co/400x250?text=L%E1%BB%97i+h%C3%ACnh+%E1%BA%A3nh";
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(imgIdx)}
                  className="absolute top-3 right-3 rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white shadow-sm hover:bg-red-700"
                >
                  Xóa
                </button>
              </div>
            ))}
            <MediaUploader
              type="image"
              value=""
              onChange={handleAddImage}
              label="+ Thêm ảnh bài đọc"
              placeholder="https://example.com/passage-doc.png"
            />
          </div>
        </div>
      )}
    </div>
  );
}
