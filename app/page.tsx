"use client";

import { FormEvent, useState } from "react";

type Source = { id: string; title: string; section: string; distance: number };
type Message = { id: string; role: "user" | "assistant"; content: string; sources?: Source[] };
type ChatEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

const starters = ["이력서 제출 기준이 뭐야?", "면접 준비 규칙을 알려줘", "지원 자격을 확인해줘"];

export default function Home() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask(value = question) {
    const text = value.trim();
    if (!text || isLoading) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "" }]);
    setQuestion("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "답변을 불러오지 못했습니다.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sources: Source[] = [];

      const update = (content?: string) => {
        setMessages((current) => current.map((message) =>
          message.id === assistantId ? { ...message, content: content ?? message.content, sources } : message,
        ));
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as ChatEvent;
          if (event.type === "sources") { sources = event.sources; update(); }
          if (event.type === "delta") {
            setMessages((current) => current.map((message) =>
              message.id === assistantId ? { ...message, content: message.content + event.text, sources } : message,
            ));
          }
          if (event.type === "error") throw new Error(event.message);
        }
        if (done) break;
      }
    } catch (caught) {
      setMessages((current) => current.filter((message) => message.id !== assistantId));
      setError(caught instanceof Error ? caught.message : "답변 생성 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void ask(); }

  return <main className="chatShell compactChat">
    <section className="chatPanel">
      <header className="chatHeader"><span className="spark">✦</span><div><strong>취업 규칙 도우미</strong><small>등록된 문서에서 근거를 찾아 답변합니다.</small></div></header>
      {messages.length === 0 ? <div className="emptyState">
        <div className="spark">✦</div>
        <h2>무엇이 궁금하세요?</h2>
        <p>지원 기준, 제출 서류, 면접 규칙을 편하게 질문해 보세요.</p>
        <div className="starterGrid">{starters.map((starter) => <button key={starter} onClick={() => void ask(starter)}><span>{starter}</span> →</button>)}</div>
      </div> : <div className="messageList">{messages.map((message) => {
        const citedNumbers = new Set([...message.content.matchAll(/\bS(\d+)\b/g)].map((match) => Number(match[1])));
        const citedSources = message.sources?.filter((_, index) => citedNumbers.has(index + 1)) ?? [];
        return <article className={`message ${message.role}`} key={message.id}>
        <div className="avatar">{message.role === "user" ? "나" : "AI"}</div>
        <div className="messageBody"><strong>{message.role === "user" ? "내 질문" : "취업 규칙 도우미"}</strong>
          <div className="messageText">{message.content || "답변을 준비하고 있어요…"}</div>
          {message.role === "assistant" && citedSources.length > 0 && <div className="sources"><span>참고한 규칙</span><div className="sourceChips">{citedSources.map((source) => <span className="sourceChip" key={source.id}>{source.title} · {source.section}</span>)}</div></div>}
        </div>
      </article>;
      })}</div>}
      {error && <p className="inlineError">{error}</p>}
      <form className="composer" onSubmit={submit}>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="예: 이력서 제출 기준을 알려줘" rows={1} disabled={isLoading} />
        <button type="submit" disabled={isLoading || !question.trim()} aria-label="질문 보내기">↑</button>
      </form>
      <p className="disclaimer">등록된 문서의 근거를 바탕으로 답변합니다.</p>
    </section>
  </main>;
}
