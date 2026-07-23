import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

function isAuthed() {
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
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

  const vars = KEYS.map((key) => ({ key, value: process.env[key] ?? null }));

  return NextResponse.json({ vars });
}
