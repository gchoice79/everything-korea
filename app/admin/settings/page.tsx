'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type EnvVar = { key: string; set: boolean; preview: string | null };
type RevealedVar = { key: string; value: string | null };

export default function AdminSettings() {
  const [vars, setVars] = useState<EnvVar[] | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string | null> | null>(null);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    fetch('/api/admin/env-status')
      .then((r) => r.json())
      .then((d) => setVars(d.vars ?? []));
  }, []);

  async function reveal() {
    setRevealing(true);
    const res = await fetch('/api/admin/env-reveal');
    const data = await res.json();
    const map: Record<string, string | null> = {};
    (data.vars as RevealedVar[])?.forEach((v) => {
      map[v.key] = v.value;
    });
    setRevealed(map);
    setRevealing(false);
  }

  return (
    <main className="min-h-screen bg-[#F1EDE1] px-8 py-10 max-w-xl mx-auto">
      <Link href="/admin" className="text-xs font-mono opacity-60 inline-block mb-6">
        ← 검토 대기열로
      </Link>
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-serif text-3xl">환경변수 상태</h1>
        {!revealed && (
          <button
            onClick={reveal}
            disabled={revealing}
            className="text-xs font-mono border border-black/20 rounded-full px-4 py-2 hover:bg-black hover:text-[#F1EDE1] transition disabled:opacity-40"
          >
            {revealing ? '불러오는 중…' : '전체 값 보기'}
          </button>
        )}
        {revealed && (
          <button
            onClick={() => setRevealed(null)}
            className="text-xs font-mono border border-black/20 rounded-full px-4 py-2 hover:bg-black/5 transition"
          >
            다시 가리기
          </button>
        )}
      </div>
      <p className="text-sm opacity-60 mb-8">
        기본은 값 일부만 보여주고, &ldquo;전체 값 보기&rdquo;를 누르면 이 브라우저 화면에만 전체 값이 표시됩니다.
        다른 사람과 화면을 공유 중이라면 누르지 마세요.
      </p>

      <div className="border border-black/10 rounded-md divide-y divide-black/10">
        {vars === null && <p className="p-4 text-sm opacity-50">불러오는 중…</p>}
        {vars?.map((v) => (
          <div key={v.key} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-mono">{v.key}</p>
              <p className="text-xs opacity-50 mt-0.5 break-all">
                {revealed ? revealed[v.key] ?? '(설정 안 됨)' : v.preview}
              </p>
            </div>
            <span
              className={`text-[10px] font-mono uppercase px-2 py-1 rounded-full border shrink-0 ${
                v.set ? 'text-celadon border-celadon' : 'text-gochujang border-gochujang'
              }`}
            >
              {v.set ? '설정됨' : '설정 안 됨'}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
