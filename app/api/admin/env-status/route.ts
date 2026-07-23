import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

function isAuthed() {
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

function mask(value: string | undefined): string | null {
  if (!value) return null;
  if (value.length <= 10) return '••••••';
  return `${value.slice(0, 6)}••••${value.slice(-4)}`;
}

const KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'DEEPL_API_KEY',
  'UNSPLASH_ACCESS_KEY',
  'ADMIN_PASSWORD',
];

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const vars = KEYS.map((key) => {
    const raw = process.env[key];
    const isPublicUrl = key === 'NEXT_PUBLIC_SUPABASE_URL'; // 이미 브라우저에 공개되는 값이라 그대로 노출 가능
    return {
      key,
      set: Boolean(raw),
      preview: isPublicUrl ? raw ?? null : mask(raw),
    };
  });

  return NextResponse.json({ vars });
}
