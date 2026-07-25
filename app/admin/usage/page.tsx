'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type TokenCounts = { in: number; out: number };
type Data = {
  claude: { today: TokenCounts; month: TokenCounts; allTime: TokenCounts };
  deepl: { ok: true; used: number; limit: number } | { ok: false; error: string };
};

function StatCard({ label, tokens }: { label: string; tokens: TokenCounts }) {
  return (
    <div className="border border-black/10 rounded-md p-5">
      <p className="text-[10px] font-mono opacity-50 uppercase mb-2">{label}</p>
      <p className="font-serif text-2xl">{(tokens.in + tokens.out).toLocaleString()}</p>
      <p className="text-xs opacity-50 mt-1">
        입력 {tokens.in.toLocaleString()} · 출력 {tokens.out.toLocaleString()}
      </p>
    </div>
  );
}

export default function AdminUsage() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch('/api/admin/usage')
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <main className="min-h-screen bg-[#F1EDE1] px-8 py-10 max-w-xl mx-auto">
      <Link href="/admin" className="text-xs font-mono opacity-60 inline-block mb-6">
        ← 검토 대기열로
      </Link>
      <h1 className="font-serif text-3xl mb-2">AI 사용량</h1>
      <p className="text-sm opacity-60 mb-8">
        Claude는 API에 잔여 크레딧 조회 기능이 없어 누적 사용량(토큰 수)만 보여줍니다.
        DeepL은 실제 잔여 할당량을 보여줍니다.
      </p>

      {data === null && <p className="opacity-50 text-sm">불러오는 중…</p>}

      {data && (
        <>
          <h2 className="font-serif text-lg mb-3">Claude 토큰 사용량 (누적)</h2>
          <div className="grid grid-cols-3 gap-3 mb-10">
            <StatCard label="오늘" tokens={data.claude.today} />
            <StatCard label="이번 달" tokens={data.claude.month} />
            <StatCard label="전체" tokens={data.claude.allTime} />
          </div>

          <h2 className="font-serif text-lg mb-3">DeepL 번역 할당량</h2>
          <div className="border border-black/10 rounded-md p-5">
            {data.deepl.ok ? (
              <>
                <p className="font-serif text-2xl">
                  {data.deepl.used.toLocaleString()} / {data.deepl.limit.toLocaleString()} 자
                </p>
                <div className="w-full h-2 bg-black/10 rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full bg-black"
                    style={{
                      width: `${Math.min(100, (data.deepl.used / (data.deepl.limit || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs opacity-50 mt-2">
                  잔여 {(data.deepl.limit - data.deepl.used).toLocaleString()}자
                </p>
              </>
            ) : (
              <p className="text-sm text-red-700">DeepL 사용량 조회 실패: {data.deepl.error}</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
