import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateArticle } from '@/lib/generate-article';

function isAuthed() {
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { topic, slug, category } = await req.json();
  if (!topic || !slug || !category) {
    return NextResponse.json({ error: 'topic, slug, category는 필수입니다' }, { status: 400 });
  }

  const result = await generateArticle({ topic, slug, category });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
