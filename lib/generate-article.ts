import Anthropic from '@anthropic-ai/sdk';
import * as deepl from 'deepl-node';
import { waitUntil } from '@vercel/functions';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logClaudeUsage } from '@/lib/ai-usage';

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

export const PRIORITY_LANGS = [
  { code: 'en', deepl: 'en-US' as const },
  { code: 'ja', deepl: 'ja' as const },
  { code: 'zh', deepl: 'zh' as const },
  { code: 'hi', deepl: 'hi' as const },
  { code: 'es', deepl: 'es' as const },
  { code: 'fr', deepl: 'fr' as const },
  { code: 'ar', deepl: 'ar' as const },
  { code: 'id', deepl: 'id' as const },
  { code: 'vi', deepl: 'vi' as const },
  { code: 'pt', deepl: 'pt-BR' as const },
];

type Block = { h?: string; p?: string; img?: string };

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}

export async function translateText(
  text: string,
  translator: deepl.Translator,
  targetLang: deepl.TargetLanguageCode
): Promise<string> {
  const r = await withRetry(() => translator.translateText(text, 'ko', targetLang));
  return r.text;
}

export async function translateBlock(
  block: Block,
  translator: deepl.Translator,
  targetLang: deepl.TargetLanguageCode
): Promise<Block> {
  if (block.h) return { h: await translateText(block.h, translator, targetLang) };
  if (block.p) return { p: await translateText(block.p, translator, targetLang) };
  return block;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function suggestTopic(
  category: string
): Promise<{ ok: boolean; topic?: string; slug?: string; error?: string }> {
  try {
    const { data: categoryNameRow } = await supabaseAdmin
      .from('category_names')
      .select('name')
      .eq('category_id', category)
      .eq('lang', 'ko')
      .maybeSingle();
    const categoryName = categoryNameRow?.name ?? category;

    const { data: existing } = await supabaseAdmin
      .from('articles')
      .select('id, slug')
      .eq('category_id', category);

    let existingTopics = '';
    if (existing && existing.length) {
      const { data: titles } = await supabaseAdmin
        .from('article_translations')
        .select('article_id, title')
        .eq('lang', 'ko')
        .in('article_id', existing.map((a) => a.id));

      existingTopics = existing
        .map((a) => titles?.find((t) => t.article_id === a.id)?.title ?? a.slug)
        .join(', ');
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `"Everything Korea"라는 한국 정보 사이트의 "${categoryName}" 카테고리에 새 글 주제를 하나 추천해줘.

이미 다룬 주제: ${existingTopics || '(아직 없음)'}

위 목록과 겹치지 않는, 대중적으로 관심이 있을 만한 새로운 주제 하나를 골라줘. 영문 slug(소문자, 하이픈)도 함께 만들어줘. 다른 설명 없이 아래 JSON 형식으로만 답해줘:

{"topic": "한국어 주제", "slug": "english-slug"}`,
        },
      ],
    });

    await logClaudeUsage('suggest_topic', res.usage, res.model);

    const textBlock = res.content.find(
      (b): b is { type: 'text'; text: string } => b.type === 'text'
    );
    if (!textBlock) return { ok: false, error: 'Claude 응답을 받지 못했습니다.' };

    const cleaned = textBlock.text.trim().replace(/^```json\s*|\s*```$/g, '');
    const parsed = JSON.parse(cleaned) as { topic: string; slug: string };
    return { ok: true, topic: parsed.topic, slug: slugify(parsed.slug) };
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return { ok: false, error: message };
  }
}

export type GenerateProgress = { phase: string; current?: number; total?: number };

export async function createGeneratingArticle({
  category,
  slug,
}: {
  category: string;
  slug: string;
}): Promise<{ ok: boolean; articleId?: string; error?: string }> {
  const { data: article, error } = await supabaseAdmin
    .from('articles')
    .insert({ category_id: category, slug, status: 'generating', progress_phase: 'writing' })
    .select()
    .single();

  if (error || !article) return { ok: false, error: error?.message ?? 'DB 저장 실패' };
  return { ok: true, articleId: article.id };
}

export async function generateArticle({
  articleId,
  topic,
  slug,
  category,
}: {
  articleId: string;
  topic: string;
  slug: string;
  category: string;
}): Promise<{
  ok: boolean;
  title?: string;
  articleId?: string;
  error?: string;
  failedLangs?: string[];
}> {
  const sectionCount = 6;
  const imageCount = 4;
  const notify = async (event: GenerateProgress) => {
    await supabaseAdmin
      .from('articles')
      .update({
        progress_phase: event.phase,
        progress_current: event.current ?? null,
        progress_total: event.total ?? null,
      })
      .eq('id', articleId)
      .then(
        () => {},
        () => {}
      );
  };

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const { data: categoryNameRow } = await supabaseAdmin
      .from('category_names')
      .select('name')
      .eq('category_id', category)
      .eq('lang', 'ko')
      .maybeSingle();
    const categoryName = categoryNameRow?.name ?? category;

    await notify({ phase: 'writing' });
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: `너는 "Everything Korea"라는 한국 정보 사이트의 필자야. "${topic}"에 대한 "${categoryName}" 카테고리 글을 작성해줘. 이번엔 평소보다 길고 깊이 있는 글이 필요해.

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

    await logClaudeUsage('generate_article', res.usage, res.model);

    const textBlock = res.content.find(
      (b): b is { type: 'text'; text: string } => b.type === 'text'
    );
    if (!textBlock) {
      return await fail('Claude 응답에서 텍스트를 찾지 못했습니다.');
    }
    const raw = textBlock.text.trim();
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, '');
    const draft = JSON.parse(cleaned) as {
      title: string;
      excerpt: string;
      body: (Block & { imgQuery?: string })[];
    };

    const imgBlockCount = draft.body.filter((b) => b.imgQuery).length;
    const totalImages = imgBlockCount + 1;
    let imagesDone = 0;
    await notify({ phase: 'images', current: imagesDone, total: totalImages });

    const resolvedBody: Block[] = [];
    for (const block of draft.body) {
      if (block.imgQuery) {
        const url = await fetchImageUrl(block.imgQuery);
        imagesDone++;
        await notify({ phase: 'images', current: imagesDone, total: totalImages });
        if (url) resolvedBody.push({ img: url });
        continue;
      }
      resolvedBody.push(block);
    }
    const heroImageUrl = await fetchImageUrl(`${topic} korea`);
    imagesDone++;
    await notify({ phase: 'images', current: imagesDone, total: totalImages });

    await notify({ phase: 'saving' });
    const { error: updateError } = await supabaseAdmin
      .from('articles')
      .update({ image_url: heroImageUrl })
      .eq('id', articleId);

    if (updateError) {
      return await fail(updateError.message);
    }

    await supabaseAdmin.from('article_translations').insert({
      article_id: articleId,
      lang: 'ko',
      title: draft.title,
      excerpt: draft.excerpt,
      body: resolvedBody,
      is_machine_translated: false,
    });

    // 한국어 원고는 여기서 바로 검토 대기열에 올린다. 언어별 번역은 뒤이어
    // 하나씩(체이닝된 별도 요청으로) 채워지므로, 이 시점 이후는 60초 제한과
    // 무관하게 계속 진행된다.
    await supabaseAdmin
      .from('articles')
      .update({
        status: 'pending_review',
        progress_phase: 'translating',
        progress_current: 0,
        progress_total: PRIORITY_LANGS.length,
      })
      .eq('id', articleId);

    await translateNextLang(articleId);

    return { ok: true, title: draft.title, articleId };
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return await fail(message);
  }

  async function fail(message: string) {
    await supabaseAdmin
      .from('articles')
      .update({ status: 'failed', error: message })
      .eq('id', articleId)
      .then(
        () => {},
        () => {}
      );
    return { ok: false, error: message };
  }
}

// PRIORITY_LANGS[progress_current]가 다음에 번역할 언어. 언어 하나를 번역해
// 저장한 뒤, 다음 언어는 이 함수를 다시 호출하는 별도 요청으로 넘긴다 —
// 그래야 언어마다 새 60초 예산을 받아서 전체 번역이 함수 시간 제한에
// 걸리지 않는다.
export async function translateNextLang(articleId: string): Promise<{ ok: boolean; done?: boolean }> {
  const { data: articleRow } = await supabaseAdmin
    .from('articles')
    .select('progress_current')
    .eq('id', articleId)
    .maybeSingle();
  const index = articleRow?.progress_current ?? 0;

  if (index >= PRIORITY_LANGS.length) return { ok: true, done: true };

  const { data: koRow } = await supabaseAdmin
    .from('article_translations')
    .select('title, excerpt, body')
    .eq('article_id', articleId)
    .eq('lang', 'ko')
    .maybeSingle();
  if (!koRow) return { ok: false };

  const { code, deepl: deeplCode } = PRIORITY_LANGS[index];
  try {
    const translator = new deepl.Translator(process.env.DEEPL_API_KEY!);
    const [title, excerpt, body] = await Promise.all([
      translateText(koRow.title, translator, deeplCode),
      translateText(koRow.excerpt, translator, deeplCode),
      Promise.all((koRow.body as Block[]).map((b) => translateBlock(b, translator, deeplCode))),
    ]);
    await supabaseAdmin.from('article_translations').insert({
      article_id: articleId,
      lang: code,
      title,
      excerpt,
      body,
      is_machine_translated: true,
    });
  } catch {
    // 이 언어는 건너뛰고 다음 언어로 넘어간다 (재시도 루프에 갇히지 않도록).
  }

  const nextIndex = index + 1;
  const done = nextIndex >= PRIORITY_LANGS.length;
  await supabaseAdmin
    .from('articles')
    .update({ progress_current: nextIndex, progress_phase: done ? 'done' : 'translating' })
    .eq('id', articleId);

  if (!done) {
    waitUntil(
      fetch(`https://${process.env.VERCEL_URL}/api/admin/generate/translate-next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.ADMIN_PASSWORD ?? '',
        },
        body: JSON.stringify({ articleId }),
      }).catch(() => {})
    );
  }

  return { ok: true, done };
}
