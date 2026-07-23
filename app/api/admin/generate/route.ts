import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import * as deepl from 'deepl-node';
import { supabaseAdmin } from '@/lib/supabase-admin';

function isAuthed() {
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

async function fetchImageUrl(query: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

const PRIORITY_LANGS = [
  { code: 'en', deepl: 'en-US' as const },
  { code: 'ja', deepl: 'ja' as const },
  { code: 'zh', deepl: 'zh' as const },
];

type Block = { h?: string; p?: string };

async function translateBlock(
  block: Block,
  translator: deepl.Translator,
  targetLang: deepl.TargetLanguageCode
): Promise<Block> {
  if (block.h) {
    const r = await translator.translateText(block.h, 'ko', targetLang);
    return { h: r.text };
  }
  if (block.p) {
    const r = await translator.translateText(block.p, 'ko', targetLang);
    return { p: r.text };
  }
  return block;
}

export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { topic, slug, category } = await req.json();
  if (!topic || !slug || !category) {
    return NextResponse.json({ error: 'topic, slug, category는 필수입니다' }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const translator = new deepl.Translator(process.env.DEEPL_API_KEY!);

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `너는 "Everything Korea"라는 한국 정보 사이트의 필자야. "${topic}"에 대한 한국 음식 카테고리 글을 작성해줘.

규칙:
- 확실하지 않은 사실은 절대 넣지 마. 추측이나 과장 없이 사실에 기반해서 써.
- 제목(title), 한 문장 요약(excerpt), 본문(body)으로 구성해줘.
- 본문은 소제목(h)과 문단(p)이 번갈아 나오는 배열로 만들어줘. 소제목 2~3개, 각 소제목 아래 문단 1개씩.
- imageQuery는 이 글에 어울리는 사진을 찾기 위한 영어 검색어야. 음식이면 요리 이름의 영어 표기 정도로 짧게.
- 다른 설명 없이 아래 JSON 형식으로만 답해줘 (마크다운 코드블록 없이 순수 JSON만):

{"title": "...", "excerpt": "...", "imageQuery": "...", "body": [{"h": "..."}, {"p": "..."}, {"h": "..."}, {"p": "..."}]}`,
        },
      ],
    });

    const textBlock = res.content.find(
      (b): b is { type: 'text'; text: string } => b.type === 'text'
    );
    if (!textBlock) {
      return NextResponse.json(
        { error: 'Claude 응답에서 텍스트를 찾지 못했습니다.' },
        { status: 500 }
      );
    }
    const raw = textBlock.text.trim();
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, '');
    const draft = JSON.parse(cleaned) as {
      title: string;
      excerpt: string;
      imageQuery: string;
      body: Block[];
    };

    const imageUrl = await fetchImageUrl(draft.imageQuery || topic);

    const { data: article, error } = await supabaseAdmin
      .from('articles')
      .insert({ category_id: category, slug, status: 'pending_review', image_url: imageUrl })
      .select()
      .single();

    if (error || !article) {
      return NextResponse.json({ error: error?.message ?? 'DB 저장 실패' }, { status: 500 });
    }

    await supabaseAdmin.from('article_translations').insert({
      article_id: article.id,
      lang: 'ko',
      title: draft.title,
      excerpt: draft.excerpt,
      body: draft.body,
      is_machine_translated: false,
    });

    for (const { code, deepl: deeplCode } of PRIORITY_LANGS) {
      const title = (await translator.translateText(draft.title, 'ko', deeplCode)).text;
      const excerpt = (await translator.translateText(draft.excerpt, 'ko', deeplCode)).text;
      const body = await Promise.all(
        draft.body.map((b) => translateBlock(b, translator, deeplCode))
      );

      await supabaseAdmin.from('article_translations').insert({
        article_id: article.id,
        lang: code,
        title,
        excerpt,
        body,
        is_machine_translated: true,
      });
    }

    return NextResponse.json({ ok: true, title: draft.title, articleId: article.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
