import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { suggestTopic, generateArticle } from '@/lib/generate-article';

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

  const result = await generateArticle({
    topic: suggestion.topic,
    slug: suggestion.slug,
    category,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ...result, topic: suggestion.topic, slug: suggestion.slug });
}
