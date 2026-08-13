import { FieldPath } from "@google-cloud/firestore";
import { visibilityKeysFor } from "@/lib/server/access";
import { generateGroundedAnswer, embedText } from "@/lib/server/ai";
import { AuthError, requireUser } from "@/lib/server/auth";
import { serverDb } from "@/lib/server/firebase-admin";
import type { ChatEvent, Source } from "@/lib/shared/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChunkResult = Source & { text: string };

function eventLine(event: ChatEvent) {
  return `${JSON.stringify(event)}\n`;
}

async function retrieve(question: string, scopes: string[]): Promise<ChunkResult[]> {
  const queryVector = await embedText(question, "RETRIEVAL_QUERY");
  const snapshots = await Promise.all(
    scopes.map((visibilityKey) =>
      serverDb
        .collection("chunks")
        .where("visibilityKey", "==", visibilityKey)
        .select(
          FieldPath.documentId(),
          "documentId",
          "title",
          "section",
          "pageStart",
          "pageEnd",
          "text",
          "distance",
        )
        .findNearest({
          vectorField: "embedding",
          queryVector,
          limit: 8,
          distanceMeasure: "COSINE",
          distanceResultField: "distance",
        })
        .get(),
    ),
  );

  const merged = new Map<string, ChunkResult>();
  for (const snapshot of snapshots) {
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const item: ChunkResult = {
        id: doc.id,
        documentId: String(data.documentId),
        title: String(data.title ?? "제목 없음"),
        section: String(data.section ?? "본문"),
        pageStart:
          typeof data.pageStart === "number" ? data.pageStart : undefined,
        pageEnd: typeof data.pageEnd === "number" ? data.pageEnd : undefined,
        text: String(data.text ?? ""),
        distance: Number(data.distance ?? 2),
      };
      const current = merged.get(item.id);
      if (!current || item.distance < current.distance) merged.set(item.id, item);
    }
  }

  return [...merged.values()]
    .filter((item) => item.text.length > 0 && item.distance <= 0.55)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8);
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = (await request.json()) as { question?: unknown };
    const question = typeof body.question === "string" ? body.question.trim() : "";

    if (!question || question.length > 2000) {
      return Response.json(
        { error: "질문은 1자 이상 2,000자 이하로 입력해 주세요." },
        { status: 400 },
      );
    }

    const chunks = await retrieve(question, visibilityKeysFor(user));
    const publicSources: Source[] = chunks.map(({ text: _text, ...source }) => source);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(eventLine({ type: "sources", sources: publicSources })),
          );

          if (chunks.length === 0) {
            controller.enqueue(
              encoder.encode(
                eventLine({
                  type: "delta",
                  text: "등록된 문서에서 관련 근거를 찾지 못했습니다. 질문을 조금 더 구체적으로 입력해 주세요.",
                }),
              ),
            );
          } else {
            const evidence = chunks
              .map(
                (chunk, index) =>
                  `[S${index + 1}] 문서: ${chunk.title}\n섹션: ${chunk.section}\n내용:\n${chunk.text}`,
              )
              .join("\n\n---\n\n");
            const prompt = `질문:\n${question}\n\n검색된 근거:\n${evidence}`;

            for await (const text of generateGroundedAnswer(prompt)) {
              controller.enqueue(encoder.encode(eventLine({ type: "delta", text })));
            }
          }

          controller.enqueue(encoder.encode(eventLine({ type: "done" })));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "답변 생성 중 오류가 발생했습니다.";
          controller.enqueue(encoder.encode(eventLine({ type: "error", message })));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "요청 처리에 실패했습니다.";
    const missingIndex = message.includes("index") || message.includes("FAILED_PRECONDITION");
    return Response.json(
      {
        error: missingIndex
          ? "Firestore 벡터 인덱스가 아직 준비되지 않았습니다. README의 인덱스 생성 단계를 실행해 주세요."
          : message,
      },
      { status: 500 },
    );
  }
}
