import { FieldValue, Firestore } from "@google-cloud/firestore";
import { GoogleGenAI } from "@google/genai";
import { getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { chunkText } from "./chunking.js";
import { extractText } from "./parser.js";

if (getApps().length === 0) initializeApp();

const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) throw new Error("Google Cloud 프로젝트 ID를 확인할 수 없습니다.");

const functionRegion = process.env.FUNCTION_REGION ?? "asia-northeast3";
const aiLocation = process.env.GOOGLE_CLOUD_LOCATION ?? "global";
const embeddingModel = process.env.EMBEDDING_MODEL ?? "gemini-embedding-001";
const embeddingDimension = Number(process.env.EMBEDDING_DIMENSION ?? 1024);
const db = new Firestore({ projectId, ignoreUndefinedProperties: true });
const ai = new GoogleGenAI({ vertexai: true, project: projectId, location: aiLocation });

async function embed(text: string) {
  const response = await ai.models.embedContent({
    model: embeddingModel,
    contents: text,
    config: {
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: embeddingDimension,
    },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values?.length) throw new Error("임베딩 결과가 비어 있습니다.");
  return values;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const output = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return output;
}

async function deleteExistingChunks(documentId: string) {
  const snapshot = await db.collection("chunks").where("documentId", "==", documentId).get();
  for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
    const batch = db.batch();
    snapshot.docs.slice(offset, offset + 400).forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
}

export const indexUploadedDocument = onObjectFinalized(
  {
    region: functionRegion,
    timeoutSeconds: 540,
    memory: "1GiB",
    maxInstances: 3,
    retry: false,
  },
  async (event) => {
    const object = event.data;
    const name = object.name;
    if (!name?.startsWith("documents/")) return;

    const metadata = object.metadata ?? {};
    const documentId = metadata.documentId ?? name.split("/")[1];
    const documentRef = db.collection("documents").doc(documentId);
    const title = metadata.title ?? name.split("/").pop() ?? "제목 없음";
    const visibilityKey = metadata.visibilityKey ?? "ADMIN";

    try {
      await documentRef.set(
        {
          status: "PARSING",
          storagePath: name,
          contentType: object.contentType,
          size: Number(object.size ?? 0),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      const [buffer] = await getStorage().bucket(object.bucket).file(name).download();
      const text = await extractText(buffer, object.contentType ?? "", name);
      if (text.trim().length < 30) {
        throw new Error("추출된 텍스트가 너무 적습니다. 스캔 PDF라면 OCR 처리가 필요합니다.");
      }

      const chunks = chunkText(text);
      if (chunks.length === 0) throw new Error("문서를 청크로 분리하지 못했습니다.");
      if (chunks.length > 500) throw new Error("MVP에서는 문서당 최대 500개 청크를 지원합니다.");

      await documentRef.set(
        { status: "EMBEDDING", chunkCount: chunks.length, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );

      const embedded = await mapWithConcurrency(chunks, 4, async (chunk) => ({
        ...chunk,
        embedding: await embed(`${title}\n${chunk.section}\n${chunk.text}`),
      }));

      await documentRef.set(
        { status: "INDEXING", updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      await deleteExistingChunks(documentId);

      for (let offset = 0; offset < embedded.length; offset += 300) {
        const batch = db.batch();
        for (const chunk of embedded.slice(offset, offset + 300)) {
          const chunkRef = db.collection("chunks").doc(`${documentId}_${chunk.index}`);
          batch.set(chunkRef, {
            documentId,
            title,
            section: chunk.section,
            text: chunk.text,
            chunkIndex: chunk.index,
            visibilityKey,
            embedding: FieldValue.vector(chunk.embedding),
            embeddingModel,
            embeddingDimension,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
      }

      await documentRef.set(
        {
          status: "ACTIVE",
          chunkCount: embedded.length,
          indexedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          error: FieldValue.delete(),
        },
        { merge: true },
      );
      logger.info("Document indexed", { documentId, chunks: embedded.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "문서 처리에 실패했습니다.";
      logger.error("Document indexing failed", { documentId, message });
      await documentRef.set(
        { status: "FAILED", error: message.slice(0, 1000), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }
  },
);
