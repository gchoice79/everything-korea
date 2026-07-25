import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateArticle } from '@/lib/generate-article';

export const maxDuration = 60;

function isAuthed() {
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { topic, slug, category } = await req.json();
  if (!topic || !slug || !category) {
    return NextResponse.json({ error: 'topic, slug, category는 필수입니다' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));

      try {
        const result = await generateArticle({ topic, slug, category, onProgress: send });
        if (!result.ok) {
          send({ done: true, ok: false, error: result.error });
        } else {
          send({ ...result, done: true });
        }
      } catch (err) {
        send({ done: true, ok: false, error: err instanceof Error ? err.message : '알 수 없는 오류' });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  });
}
