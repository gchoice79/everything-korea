'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push('/admin');
      router.refresh();
    } else {
      setError(true);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F1EDE1]">
      <form onSubmit={handleSubmit} className="w-full max-w-xs p-8 border border-black/10 rounded-md">
        <h1 className="font-serif text-2xl mb-6">관리자 로그인</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="w-full border border-black/15 rounded px-3 py-2 mb-3 bg-transparent"
          autoFocus
        />
        {error && <p className="text-red-700 text-sm mb-3">비밀번호가 틀렸습니다.</p>}
        <button
          type="submit"
          className="w-full bg-black text-[#F1EDE1] rounded py-2 text-sm"
        >
          로그인
        </button>
      </form>
    </main>
  );
}
