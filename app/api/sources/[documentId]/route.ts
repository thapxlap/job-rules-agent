import { canAccessVisibility } from "@/lib/server/access";
import { AuthError, requireUser } from "@/lib/server/auth";
import { adminStorage, serverDb } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const user = await requireUser(request);
    const { documentId } = await context.params;
    const snapshot = await serverDb.collection("documents").doc(documentId).get();
    if (!snapshot.exists) return Response.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });

    const data = snapshot.data() ?? {};
    if (!canAccessVisibility(user, data.visibilityKey)) {
      return Response.json({ error: "문서 접근 권한이 없습니다." }, { status: 403 });
    }
    if (typeof data.storagePath !== "string") {
      return Response.json({ error: "원본 파일 경로가 없습니다." }, { status: 404 });
    }

    const [url] = await adminStorage.bucket().file(data.storagePath).getSignedUrl({
      action: "read",
      expires: Date.now() + 5 * 60 * 1000,
    });
    return Response.json({ url });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "원문 링크 생성에 실패했습니다." }, { status: 500 });
  }
}
