import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { waitUntil } from '@vercel/functions';
import { suggestTopic, createGeneratingArticle, generateArticle } from '@/lib/generate-article';

export const maxDuration = 180;

function isAuthed() {
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { category } = await req.json();
  if (!category) {
    return NextResponse.json({ error: 'category는 필수입니다' }, { status: 400 });
  }

  const suggestion = await suggestTopic(category);
  if (!suggestion.ok || !suggestion.topic || !suggestion.slug) {
    return NextResponse.json({ error: suggestion.error ?? '주제 추천 실패' }, { status: 500 });
  }

  const created = await createGeneratingArticle({ category, slug: suggestion.slug });
  if (!created.ok || !created.articleId) {
    return NextResponse.json({ error: created.error ?? 'DB 저장 실패' }, { status: 500 });
  }

  waitUntil(generateArticle({ articleId: created.articleId, topic: suggestion.topic, category }));

  return NextResponse.json({ ok: true, articleId: created.articleId, topic: suggestion.topic });
}
