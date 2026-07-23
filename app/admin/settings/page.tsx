'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type EnvVar = { key: string; set: boolean; preview: string | null };

export default function AdminSettings() {
  const [vars, setVars] = useState<EnvVar[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/env-status')
      .then((r) => r.json())
      .then((d) => setVars(d.vars ?? []));
  }, []);

  return (
    <main className="min-h-screen bg-[#F1EDE1] px-8 py-10 max-w-xl mx-auto">
      <Link href="/admin" className="text-xs font-mono opacity-60 inline-block mb-6">
        ← 검토 대기열로
      </Link>
      <h1 className="font-serif text-3xl mb-2">환경변수 상태</h1>
      <p className="text-sm opacity-60 mb-8">
        보안을 위해 값 전체는 보여주지 않고, 설정 여부와 일부만 확인할 수 있게 했습니다.
      </p>

      <div className="border border-black/10 rounded-md divide-y divide-black/10">
        {vars === null && <p className="p-4 text-sm opacity-50">불러오는 중…</p>}
        {vars?.map((v) => (
          <div key={v.key} className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-mono">{v.key}</p>
              {v.preview && <p className="text-xs opacity-50 mt-0.5">{v.preview}</p>}
            </div>
            <span
              className={`text-[10px] font-mono uppercase px-2 py-1 rounded-full border ${
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
