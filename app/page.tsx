"use client";

import { useState } from "react";
type JobRule = { id: string; title: string; category: string; content: string; section: string; distance: number };

const examples = ["이력서", "면접 복장", "지원 자격"];

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [rules, setRules] = useState<JobRule[]>([]);
  const [message, setMessage] = useState("검색어를 입력해 취업 규칙을 찾아보세요.");

  async function search(value = keyword) {
    const term = value.trim();
    if (!term) return;
    setKeyword(value); setMessage("검색 중…");
    try {
      const response = await fetch("/api/rules/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: term }) });
      const payload = await response.json() as { results?: JobRule[]; error?: string };
      if (!response.ok) throw new Error(payload.error);
      const found = payload.results ?? [];
      setRules(found);
      setMessage(found.length ? `${found.length}개의 규칙을 찾았습니다.` : "일치하는 규칙이 없습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "검색에 실패했습니다."); }
  }

  return <main className="appShell">
    <section className="hero"><span className="eyebrow">JOB RULES · MVP</span><h1>취업 규칙 검색</h1><p>지원 전에 꼭 확인해야 할 기준을 빠르게 찾아보세요.</p></section>
    <section className="searchCard">
      <form onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="예: 이력서, 면접, 경력" />
        <button disabled={!keyword.trim()}>검색</button>
      </form>
      <div className="examples">추천: {examples.map((item) => <button key={item} onClick={() => void search(item)}>{item}</button>)}</div>
    </section>
    <p className="resultMessage">{message}</p>
    <section className="ruleList">{rules.map((rule) => <article className="ruleCard" key={rule.id}><span>{rule.category} · {rule.section}</span><h2>{rule.title}</h2><p>{rule.content}</p></article>)}</section>
  </main>;
}
