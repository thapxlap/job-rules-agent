import { FieldPath } from "@google-cloud/firestore";
import { embedText } from "@/lib/server/ai";
import { serverDb } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { query } = await request.json() as { query?: unknown };
    const question = typeof query === "string" ? query.trim() : "";
    if (!question || question.length > 500) return Response.json({ error: "1~500자 검색어를 입력해 주세요." }, { status: 400 });
    const vector = await embedText(question, "RETRIEVAL_QUERY");
    const snapshot = await serverDb.collection("chunks").where("visibilityKey", "==", "PUBLIC").select(FieldPath.documentId(), "documentId", "title", "category", "section", "text", "distance").findNearest({ vectorField: "embedding", queryVector: vector, limit: 8, distanceMeasure: "COSINE", distanceResultField: "distance" }).get();
    const results = snapshot.docs.map((doc) => { const data = doc.data(); return { id: doc.id, documentId: String(data.documentId), title: String(data.title), category: String(data.category ?? "기타"), section: String(data.section ?? "본문"), content: String(data.text ?? ""), distance: Number(data.distance ?? 2) }; }).filter((item) => item.distance <= 0.65);
    return Response.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "검색에 실패했습니다.";
    return Response.json({ error: message.includes("index") ? "벡터 인덱스가 아직 준비되지 않았습니다." : message }, { status: 500 });
  }
}
