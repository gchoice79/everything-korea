import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

function isAuthed() {
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { messages } = await req.json();
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: 'messages는 필수입니다' }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      system:
        '너는 "Everything Korea" 사이트(한국 관련 콘텐츠를 여러 언어로 제공하는 사이트)의 관리자를 돕는 어시스턴트야. 글 검토, 사이트 운영, 콘텐츠 아이디어, 일반적인 질문에 대해 간결하고 실용적으로 답해줘.',
      messages,
    });

    const textBlock = res.content.find(
      (b): b is { type: 'text'; text: string } => b.type === 'text'
    );

    return NextResponse.json({ reply: textBlock?.text ?? '' });
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
