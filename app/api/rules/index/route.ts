import { FieldValue } from "@google-cloud/firestore";
import { embedText } from "@/lib/server/ai";
import { serverDb } from "@/lib/server/firebase-admin";
import { splitRuleText } from "@/lib/shared/chunking";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { title?: unknown; category?: unknown; content?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "기타";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!title || content.length < 20 || content.length > 50_000) return Response.json({ error: "제목과 20~50,000자 규칙 내용을 입력해 주세요." }, { status: 400 });
    const ruleRef = serverDb.collection("jobRules").doc();
    const chunks = splitRuleText(content);
    await ruleRef.set({ title, category, content, status: "EMBEDDING", chunkCount: chunks.length, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    const embedded = await Promise.all(chunks.map(async (chunk) => ({ ...chunk, embedding: await embedText(`${title}\n${category}\n${chunk.section}\n${chunk.text}`, "RETRIEVAL_DOCUMENT") })));
    const batch = serverDb.batch();
    for (const chunk of embedded) batch.set(serverDb.collection("chunks").doc(`${ruleRef.id}_${chunk.index}`), { documentId: ruleRef.id, title, category, section: chunk.section, text: chunk.text, chunkIndex: chunk.index, visibilityKey: "PUBLIC", embedding: FieldValue.vector(chunk.embedding), embeddingModel: process.env.EMBEDDING_MODEL ?? "gemini-embedding-001", embeddingDimension: Number(process.env.EMBEDDING_DIMENSION ?? 1024), createdAt: FieldValue.serverTimestamp() });
    batch.set(ruleRef, { status: "ACTIVE", chunkCount: chunks.length, indexedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();
    return Response.json({ id: ruleRef.id, chunkCount: chunks.length, status: "ACTIVE" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "임베딩 처리에 실패했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
