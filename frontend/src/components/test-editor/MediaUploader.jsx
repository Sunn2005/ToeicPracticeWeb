import { useState, useRef } from "react";
import { uploadEmployeeMedia } from "../../api/employeeTests";

/**
 * MediaUploader
 *
 * @param {"audio"|"image"} type - type of media
 * @param {string} value - current URL
 * @param {function(string)} onChange - callback with new URL
 * @param {string} label - custom label
 * @param {string} placeholder - URL input placeholder
 */
export default function MediaUploader({
  type = "image",
  value = "",
  onChange,
  label,
  placeholder,
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef(null);

  const defaultLabel = type === "audio" ? "Tệp âm thanh (Audio)" : "Hình ảnh tham chiếu";
  const defaultPlaceholder =
    type === "audio"
      ? "https://example.com/audio.mp3"
      : "https://example.com/image.png";

  const accept =
    type === "audio"
      ? "audio/mp3,audio/mpeg,audio/wav,audio/ogg"
      : "image/png,image/jpeg,image/webp,image/gif";

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const response = await uploadEmployeeMedia(file);
      const uploadedUrl = response?.url || response?.mediaUrl || response?.fileUrl;
      if (uploadedUrl) {
        onChange(uploadedUrl);
      } else {
        // Fallback: create an object URL for local preview if server returns raw object
        const localUrl = URL.createObjectURL(file);
        onChange(localUrl);
      }
    } catch (err) {
      setError(err?.message || "Tải lên tệp thất bại. Vui lòng nhập URL trực tiếp.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleApplyUrl = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput("");
      setShowUrlInput(false);
      setError("");
    }
  };

  const handleRemove = () => {
    onChange("");
    setError("");
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <span className="text-[#2188ee]">
            {type === "audio" ? "🎵" : "🖼️"}
          </span>
          {label || defaultLabel}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-xs font-semibold text-[#2188ee] hover:underline"
        >
          {showUrlInput ? "Ẩn nhập link" : "Nhập link trực tiếp"}
        </button>
      </div>

      {showUrlInput && (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={placeholder || defaultPlaceholder}
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-400 focus:bg-white"
          />
          <button
            type="button"
            onClick={handleApplyUrl}
            className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-600"
          >
            Áp dụng
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />

      {value ? (
        <div className="relative rounded-lg border border-slate-200 bg-slate-50 p-3">
          {type === "image" ? (
            <div className="group relative flex flex-col items-center">
              <div className="max-h-56 w-full overflow-hidden rounded-md bg-slate-100 flex items-center justify-center">
                <img
                  src={value}
                  alt="Ảnh câu hỏi"
                  className="max-h-56 object-contain rounded"
                  onError={(e) => {
                    e.currentTarget.src = "https://placehold.co/400x250?text=L%E1%BB%97i+h%C3%ACnh+%E1%BA%A3nh";
                  }}
                />
              </div>
              <div className="mt-2 flex w-full items-center justify-between">
                <span className="truncate text-[11px] text-slate-500 max-w-[200px]" title={value}>
                  {value}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="rounded bg-white px-2 py-1 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-xs"
                  >
                    Đổi ảnh
                  </button>
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="truncate text-xs font-medium text-slate-700 max-w-[240px]" title={value}>
                  {value.split("/").pop() || "audio.mp3"}
                </span>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-xs font-bold text-red-500 hover:text-red-700"
                >
                  Xóa
                </button>
              </div>
              <audio
                controls
                src={value}
                className="h-9 w-full rounded-md border border-slate-200"
              />
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-5 transition hover:border-blue-400 hover:bg-blue-50/40"
        >
          {uploading ? (
            <div className="flex items-center gap-2 py-3 text-xs font-bold text-blue-600">
              <svg className="h-4 w-4 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Đang tải tệp lên...
            </div>
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-xs border border-slate-200 group-hover:border-blue-300">
                <span className="text-lg">
                  {type === "audio" ? "🎧" : "📤"}
                </span>
              </div>
              <p className="mt-2 text-xs font-bold text-slate-700 group-hover:text-blue-600">
                {type === "audio" ? "Chọn tệp âm thanh MP3/WAV" : "Tải lên hình ảnh"}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {type === "audio" ? "Dung lượng tối đa 15MB" : "Hỗ trợ PNG, JPG, WebP"}
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="rounded bg-red-50 p-2 text-xs text-red-600 border border-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
