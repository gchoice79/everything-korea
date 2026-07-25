import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { writeDraft } from '@/lib/generate-article';

export const maxDuration = 60;

function isAuthed(req: NextRequest) {
  if (req.headers.get('x-internal-secret') === process.env.ADMIN_PASSWORD) return true;
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { articleId, topic, category } = await req.json();
  if (!articleId || !topic || !category) {
    return NextResponse.json({ error: 'articleId, topic, category는 필수입니다' }, { status: 400 });
  }

  const result = await writeDraft({ articleId, topic, category });
  return NextResponse.json(result);
}
