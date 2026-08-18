import { serverDb } from "@/lib/server/firebase-admin";
import { ManagementAuthError, requireManagementPassword } from "@/lib/server/management";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requireManagementPassword(request);
    const snapshot = await serverDb.collection("jobRules").orderBy("createdAt", "desc").get();
    const documents = snapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.();
      return {
        id: doc.id,
        title: String(data.title ?? "제목 없음"),
        category: String(data.category ?? "기타"),
        status: String(data.status ?? "UNKNOWN"),
        chunkCount: Number(data.chunkCount ?? 0),
        createdAt: createdAt?.toISOString() ?? null,
      };
    });
    return Response.json({ documents });
  } catch (error) {
    if (error instanceof ManagementAuthError) return Response.json({ error: error.message }, { status: 401 });
    const message = error instanceof Error ? error.message : "문서 목록을 불러오지 못했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    requireManagementPassword(request);
    const { id } = await request.json() as { id?: unknown };
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{8,}$/.test(id)) {
      return Response.json({ error: "삭제할 문서가 올바르지 않습니다." }, { status: 400 });
    }

    const ruleRef = serverDb.collection("jobRules").doc(id);
    const rule = await ruleRef.get();
    if (!rule.exists) return Response.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });

    let deletedChunks = 0;
    while (true) {
      const chunks = await serverDb.collection("chunks").where("documentId", "==", id).limit(400).get();
      if (chunks.empty) break;
      const batch = serverDb.batch();
      chunks.docs.forEach((chunk) => batch.delete(chunk.ref));
      await batch.commit();
      deletedChunks += chunks.size;
    }

    await ruleRef.delete();
    return Response.json({ id, deletedChunks });
  } catch (error) {
    if (error instanceof ManagementAuthError) return Response.json({ error: error.message }, { status: 401 });
    const message = error instanceof Error ? error.message : "문서를 삭제하지 못했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
