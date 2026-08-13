export type PreviewChunk = { index: number; section: string; text: string };

export function splitRuleText(input: string, targetChars = 900, overlapChars = 120): PreviewChunk[] {
  const text = input.replace(/\r\n/g, "\n").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];
  const paragraphs = text.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const result: PreviewChunk[] = [];
  let section = "본문"; let buffer = "";
  const add = (value: string) => { const clean = value.trim(); if (clean) result.push({ index: result.length + 1, section, text: clean }); };
  for (const paragraph of paragraphs) {
    if (paragraph.length < 80 && (/^(제\s*\d+\s*조|\d+(\.\d+)*[.)]|#+\s)/.test(paragraph))) section = paragraph.replace(/^#+\s*/, "");
    const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (next.length > targetChars && buffer) { add(buffer); buffer = buffer.slice(-overlapChars); }
    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    while (buffer.length > targetChars) { add(buffer.slice(0, targetChars)); buffer = buffer.slice(targetChars - overlapChars); }
  }
  add(buffer);
  return result.filter((chunk) => chunk.text.length >= 20);
}
