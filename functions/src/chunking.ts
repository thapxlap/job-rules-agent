export type TextChunk = {
  index: number;
  section: string;
  text: string;
};

const TARGET_CHARS = 1900;
const OVERLAP_CHARS = 220;

function normalize(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksLikeHeading(paragraph: string) {
  if (paragraph.length > 80 || paragraph.includes("。")) return false;
  return (
    /^(제?\d+[장절조항]|\d+(\.\d+)*[.)]?\s|[가-힣A-Z][^.!?]{1,45}:?$)/.test(paragraph) ||
    paragraph.startsWith("#")
  );
}

export function chunkText(input: string): TextChunk[] {
  const text = normalize(input);
  if (!text) return [];

  const paragraphs = text.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const chunks: TextChunk[] = [];
  let section = "본문";
  let buffer = "";

  const flush = () => {
    const value = buffer.trim();
    if (!value) return;
    chunks.push({ index: chunks.length, section, text: value });
    buffer = value.slice(-OVERLAP_CHARS);
  };

  for (const paragraph of paragraphs) {
    if (looksLikeHeading(paragraph)) section = paragraph.replace(/^#+\s*/, "");

    if (paragraph.length > TARGET_CHARS) {
      if (buffer.length > OVERLAP_CHARS) flush();
      let offset = 0;
      while (offset < paragraph.length) {
        const end = Math.min(offset + TARGET_CHARS, paragraph.length);
        const piece = paragraph.slice(offset, end).trim();
        if (piece) chunks.push({ index: chunks.length, section, text: piece });
        if (end === paragraph.length) break;
        offset = Math.max(end - OVERLAP_CHARS, offset + 1);
      }
      buffer = paragraph.slice(-OVERLAP_CHARS);
      continue;
    }

    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length > TARGET_CHARS && buffer.length > OVERLAP_CHARS) flush();
    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
  }

  if (buffer.trim().length > OVERLAP_CHARS || chunks.length === 0) {
    chunks.push({ index: chunks.length, section, text: buffer.trim() });
  }

  return chunks.filter((chunk) => chunk.text.length >= 30);
}
