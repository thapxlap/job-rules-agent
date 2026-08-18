"use client";

import { useCallback, useEffect, useState } from "react";

type RuleDocument = {
  id: string; title: string; category: string; status: string; chunkCount: number; createdAt: string | null;
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<RuleDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/rules/documents", { headers: { "x-management-password": password } });
      const data = await response.json() as { documents?: RuleDocument[]; error?: string };
      if (!response.ok) throw new Error(data.error);
      setDocuments(data.documents ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "문서 목록을 불러오지 못했습니다.");
    } finally { setLoading(false); }
  }, [password]);

  useEffect(() => { if (unlocked) void load(); }, [load, unlocked]);

  async function remove(document: RuleDocument) {
    if (!window.confirm(`“${document.title}” 문서와 ${document.chunkCount}개 임베딩 청크를 모두 삭제할까요?`)) return;
    setDeletingId(document.id); setMessage("");
    try {
      const response = await fetch("/api/rules/documents", { method: "DELETE", headers: { "Content-Type": "application/json", "x-management-password": password }, body: JSON.stringify({ id: document.id }) });
      const data = await response.json() as { deletedChunks?: number; error?: string };
      if (!response.ok) throw new Error(data.error);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setMessage(`${data.deletedChunks ?? 0}개 임베딩 청크를 함께 삭제했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "문서를 삭제하지 못했습니다.");
    } finally { setDeletingId(""); }
  }

  return <main className="adminShell documentsShell">
    <span className="eyebrow">KNOWLEDGE BASE</span>
    <div className="adminHeading"><div><h1>문서 관리</h1><p>색인된 문서와 벡터 임베딩 청크를 관리합니다.</p></div>{unlocked && <button className="secondaryButton" onClick={() => void load()} disabled={loading}>새로고침</button>}</div>
    {!unlocked && <section className="managementGate"><h2>관리 비밀번호</h2><p>문서 목록과 삭제 기능은 관리 비밀번호로 보호됩니다.</p><form onSubmit={(event) => { event.preventDefault(); setMessage(""); setUnlocked(true); }}><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="관리 비밀번호 입력" autoComplete="current-password" required /><button className="primaryButton">문서 관리 열기</button></form></section>}
    {unlocked && <>
    {message && <p className="successMessage">{message}</p>}
    <section className="documentsCard">
      <div className="sectionHeading"><h2>색인된 문서</h2><span>{documents.length}개</span></div>
      {loading ? <p className="muted">문서 목록을 불러오는 중입니다.</p> : documents.length === 0 ? <p className="muted">아직 등록된 문서가 없습니다.</p> : <div className="documentList">{documents.map((document) => <article className="documentRow" key={document.id}>
        <div className="fileIcon">DOC</div><div className="documentInfo"><strong>{document.title}</strong><span>{document.category} · 임베딩 {document.chunkCount}개 · {document.createdAt ? new Date(document.createdAt).toLocaleDateString("ko-KR") : "날짜 미확인"}</span></div>
        <div className="documentMeta"><span className={`status status-${document.status.toLowerCase()}`}>{document.status}</span><button className="deleteButton" onClick={() => void remove(document)} disabled={deletingId === document.id}>{deletingId === document.id ? "삭제 중" : "삭제"}</button></div>
      </article>)}</div>}
    </section>
    <p className="deletionNote">삭제하면 해당 문서 원문과 Firestore Vector Search에 저장된 모든 임베딩 청크가 함께 제거됩니다.</p>
    </>}
  </main>;
}
