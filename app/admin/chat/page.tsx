'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function AdminChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const next = [...messages, { role: 'user', content: input } as Msg];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages([...next, { role: 'assistant', content: data.reply ?? data.error ?? '오류가 발생했습니다.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F1EDE1] px-8 py-10 max-w-2xl mx-auto flex flex-col h-screen">
      <Link href="/admin" className="text-xs font-mono opacity-60 inline-block mb-4">
        ← 검토 대기열로
      </Link>
      <h1 className="font-serif text-3xl mb-6">AI 채팅</h1>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4 border border-black/10 rounded-md p-4 bg-white/40">
        {messages.length === 0 && (
          <p className="text-sm opacity-40">
            사이트 운영, 글 검토, 콘텐츠 아이디어 등 무엇이든 물어보세요.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm whitespace-pre-wrap p-3 rounded-md max-w-[85%] ${
              m.role === 'user' ? 'bg-black text-[#F1EDE1] ml-auto' : 'bg-white'
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && <p className="text-xs opacity-40 font-mono">답변 작성 중…</p>}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="메시지를 입력하세요"
          className="flex-1 border border-black/20 rounded-full px-4 py-2 text-sm bg-white"
        />
        <button
          onClick={send}
          disabled={loading}
          className="text-xs font-mono border border-black/20 rounded-full px-5 py-2 hover:bg-black hover:text-[#F1EDE1] transition disabled:opacity-40 shrink-0"
        >
          보내기
        </button>
      </div>
    </main>
  );
}
