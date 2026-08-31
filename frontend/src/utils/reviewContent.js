function addReadableBreaks(value) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+(?=\([A-D]\)\s)/g, "\n")
    .replace(
      /[ \t]+(?=(?:Useful Structures?|Useful phrases):)/gi,
      "\n\n",
    )
    .replace(/^Chọn\n(?=\([A-D]\))/i, "Chọn ")
    .replace(/^(Chọn \([A-D]\)[^.]*\.)\s+/i, "$1\n\n")
    .replace(/^(Đáp án [A-D] đúng vì:)[ \t]*/i, "$1\n")
    .replace(/[ \t]+(?=\(\d+\)["“])/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getReviewParagraphs(value) {
  if (!value || !value.trim()) {
    return [];
  }

  return addReadableBreaks(value)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function formatListeningTranscript(value, partNumber) {
  if (!value || !value.trim()) {
    return "";
  }

  let formatted = value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n");

  if (partNumber === 3) {
    formatted = formatted.replace(
      /[ \t\n]+(?=(?:W|M)\d?:\s)/g,
      "\n\n",
    );
  } else if (partNumber === 4) {
    formatted = formatted.replace(
      /([.!?]["']?)[ \t]+(?=[A-Z])/g,
      "$1\n\n",
    );
  }

  return formatted.replace(/\n{3,}/g, "\n\n").trim();
}
