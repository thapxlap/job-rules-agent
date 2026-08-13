import mammoth from "mammoth";
import pdf from "pdf-parse";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function extractText(buffer: Buffer, contentType: string, name: string) {
  if (contentType === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
    const result = await pdf(buffer);
    return result.text;
  }

  if (contentType === DOCX || name.toLowerCase().endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (
    contentType.startsWith("text/") ||
    name.toLowerCase().endsWith(".txt") ||
    name.toLowerCase().endsWith(".md")
  ) {
    return buffer.toString("utf8");
  }

  throw new Error("지원하지 않는 파일 형식입니다. PDF, DOCX, TXT, MD만 지원합니다.");
}
