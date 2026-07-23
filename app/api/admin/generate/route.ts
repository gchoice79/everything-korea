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

type Block = { h?: string; p?: string; img?: string };

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
  const sectionCount = 6;
  const imageCount = 4;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const translator = new deepl.Translator(process.env.DEEPL_API_KEY!);

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `너는 "Everything Korea"라는 한국 정보 사이트의 필자야. "${topic}"에 대한 한국 음식 카테고리 글을 작성해줘. 이번엔 평소보다 길고 깊이 있는 글이 필요해.

규칙:
- 확실하지 않은 사실은 절대 넣지 마. 추측이나 과장 없이 사실에 기반해서 써.
- 제목(title), 한 문장 요약(excerpt), 본문(body)으로 구성해줘.
- 본문은 소제목(h)과 문단(p)이 번갈아 나오는 배열로 만들어줘. 소제목 ${sectionCount}개, 각 소제목 아래 문단 1~2개씩 (총 분량이 넉넉하게, 문단은 3~5문장으로 충분히 길게).
- 본문 배열 중 자연스러운 지점 ${imageCount}군데에 {"imgQuery": "영어 검색어"} 블록을 끼워넣어줘 (사진이 들어갈 자리). 첫 소제목 시작 전에 하나, 이후 소제목들 사이사이에 고르게 분산해줘. 검색어는 그 부분 내용과 어울리는 실제 사진을 찾기 위한 짧은 영어 표현이어야 해.
- 다른 설명 없이 아래 JSON 형식으로만 답해줘 (마크다운 코드블록 없이 순수 JSON만):

{"title": "...", "excerpt": "...", "body": [{"imgQuery": "..."}, {"h": "..."}, {"p": "..."}, {"p": "..."}, {"imgQuery": "..."}, {"h": "..."}, {"p": "..."}]}`,
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
      body: (Block & { imgQuery?: string })[];
    };

    const resolvedBody: Block[] = [];
    let heroImageUrl: string | null = null;
    for (const block of draft.body) {
      if (block.imgQuery) {
        const url = await fetchImageUrl(block.imgQuery);
        if (url) {
          if (!heroImageUrl) heroImageUrl = url;
          resolvedBody.push({ img: url });
        }
        continue;
      }
      resolvedBody.push(block);
    }
    if (!heroImageUrl) heroImageUrl = await fetchImageUrl(topic);

    const { data: article, error } = await supabaseAdmin
      .from('articles')
      .insert({ category_id: category, slug, status: 'pending_review', image_url: heroImageUrl })
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
      body: resolvedBody,
      is_machine_translated: false,
    });

    for (const { code, deepl: deeplCode } of PRIORITY_LANGS) {
      const title = (await translator.translateText(draft.title, 'ko', deeplCode)).text;
      const excerpt = (await translator.translateText(draft.excerpt, 'ko', deeplCode)).text;
      const body = await Promise.all(
        resolvedBody.map((b) => translateBlock(b, translator, deeplCode))
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
