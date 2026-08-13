"use client";

import { useMemo, useState } from "react";

export default function SetupPage() {
  const [projectId, setProjectId] = useState("");
  const [copied, setCopied] = useState(false);
  const env = useMemo(() => `NEXT_PUBLIC_FIREBASE_API_KEY=\nNEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${projectId || "YOUR_PROJECT_ID"}.firebaseapp.com\nNEXT_PUBLIC_FIREBASE_PROJECT_ID=${projectId || "YOUR_PROJECT_ID"}\nNEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${projectId || "YOUR_PROJECT_ID"}.firebasestorage.app\nNEXT_PUBLIC_FIREBASE_APP_ID=\n\nGOOGLE_CLOUD_PROJECT=${projectId || "YOUR_PROJECT_ID"}\nGOOGLE_CLOUD_LOCATION=asia-northeast3\nGEMINI_MODEL=gemini-2.5-flash\nEMBEDDING_MODEL=gemini-embedding-001\nEMBEDDING_DIMENSION=1024`, [projectId]);
  async function copy() { await navigator.clipboard.writeText(env); setCopied(true); }
  return <main className="adminShell setupShell"><span className="eyebrow">FIREBASE SETUP</span><h1>프로젝트 연결</h1><p className="subtle">Firebase Console의 프로젝트 설정에서 프로젝트 ID와 웹 앱 구성값을 확인하세요.</p><section className="setupCard"><label>Firebase 프로젝트 ID<input value={projectId} onChange={(event) => { setProjectId(event.target.value.trim()); setCopied(false); }} placeholder="예: job-rules-mvp" /></label><p className="hint">프로젝트 ID는 URL이 아니라 <code>job-rules-mvp</code> 같은 식별자입니다.</p><h2>.env.local 내용</h2><pre>{env}</pre><button onClick={() => void copy()} disabled={!projectId}>{copied ? "복사됨" : "환경 변수 복사"}</button></section><section className="nextCard"><h2>연결 후 실행</h2><ol><li>복사한 내용을 프로젝트 루트의 <code>.env.local</code>에 붙여 넣고 API Key·App ID를 채웁니다.</li><li>Google Cloud Console에서 Vertex AI API를 켭니다.</li><li><code>.\scripts\create-vector-index.ps1 -ProjectId '{projectId || "YOUR_PROJECT_ID"}'</code>를 실행합니다.</li></ol></section></main>;
}
