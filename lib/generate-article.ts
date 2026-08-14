import Anthropic from '@anthropic-ai/sdk';
import * as deepl from 'deepl-node';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logClaudeUsage } from '@/lib/ai-usage';

async function fetchImageUrl(query: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    // 검색어에 맞는 사진이 거의 없으면(엉뚱한 사진이 대신 걸릴 가능성이 큼)
    // 억지로 채우지 않고 건너뛴다.
    if (!data.results?.length || data.total < 3) return null;
    return data.results[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

export const PRIORITY_LANGS = [
  { code: 'en', deepl: 'en-US' as const, label: 'English' },
  { code: 'ja', deepl: 'ja' as const, label: 'Japanese' },
  { code: 'zh', deepl: 'zh' as const, label: 'Chinese (Simplified)' },
  { code: 'hi', deepl: 'hi' as const, label: 'Hindi' },
  { code: 'es', deepl: 'es' as const, label: 'Spanish' },
  { code: 'fr', deepl: 'fr' as const, label: 'French' },
  { code: 'ar', deepl: 'ar' as const, label: 'Arabic' },
  { code: 'id', deepl: 'id' as const, label: 'Indonesian' },
  { code: 'vi', deepl: 'vi' as const, label: 'Vietnamese' },
  { code: 'pt', deepl: 'pt-BR' as const, label: 'Portuguese (Brazil)' },
];

// DeepL 사용량이 이 비율 이상이면 이번 번역은 Claude로 돌린다.
const DEEPL_USAGE_THRESHOLD = 0.9;

export type TranslationEngine =
  | { kind: 'deepl'; translator: deepl.Translator }
  | { kind: 'claude'; anthropic: Anthropic };

export async function pickTranslationEngine(
  translator: deepl.Translator
): Promise<'deepl' | 'claude'> {
  try {
    const usage = await translator.getUsage();
    const used = usage.character?.count ?? 0;
    const limit = usage.character?.limit ?? 0;
    if (limit > 0 && used / limit >= DEEPL_USAGE_THRESHOLD) return 'claude';
    return 'deepl';
  } catch {
    // 사용량 조회 자체가 실패하면(키 만료 등) 안전하게 Claude로 돌린다.
    return 'claude';
  }
}

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

async function translateTextWithClaude(
  text: string,
  targetLangLabel: string,
  anthropic: Anthropic
): Promise<string> {
  const res = await withRetry(() =>
    anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `다음 한국어 텍스트를 ${targetLangLabel}로 번역해줘. 의미와 어조를 그대로 유지하고, 다른 설명 없이 번역 결과만 출력해:\n\n${text}`,
        },
      ],
    })
  );
  await logClaudeUsage('translate', res.usage, res.model);
  const textBlock = res.content.find(
    (b): b is { type: 'text'; text: string } => b.type === 'text'
  );
  if (!textBlock) throw new Error('Claude 번역 응답에서 텍스트를 찾지 못했습니다.');
  return textBlock.text.trim();
}

export async function translateText(
  text: string,
  engine: TranslationEngine,
  targetLang: deepl.TargetLanguageCode,
  targetLangLabel: string
): Promise<string> {
  if (engine.kind === 'claude') {
    return translateTextWithClaude(text, targetLangLabel, engine.anthropic);
  }
  const r = await withRetry(() => engine.translator.translateText(text, 'ko', targetLang));
  // 여러 DeepL 요청을 동시에 쏘면 몇 번 성공하다가 한동안 전부 막혀버리는 걸
  // 실측으로 확인했다(백필 스크립트에서 65개 중 62개 연쇄 timeout). 호출
  // 사이에 짧은 간격을 둬서 항상 순차적으로만 나가도록 강제한다.
  await new Promise((resolve) => setTimeout(resolve, 300));
  return r.text;
}

export async function translateBlock(
  block: Block,
  engine: TranslationEngine,
  targetLang: deepl.TargetLanguageCode,
  targetLangLabel: string
): Promise<Block> {
  if (block.h) return { h: await translateText(block.h, engine, targetLang, targetLangLabel) };
  if (block.p) return { p: await translateText(block.p, engine, targetLang, targetLangLabel) };
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

// 브라우저 탭을 닫아도 서버는 계속 진행되도록, 이 함수는 (waitUntil로) 클라이언트
// 응답과 분리되어 실행된다. Vercel의 Fluid Compute가 함수당 최대 300초까지
// 지원하므로 (route.ts의 maxDuration 참고), 글쓰기·이미지·10개 언어 번역을
// 전부 이 하나의 실행 안에서 순서대로 처리한다 — 여러 요청으로 쪼개서 서로
// 체이닝하는 방식은 자기 자신을 호출하는 fetch가 응답 이후 안정적으로
// 도착한다는 보장이 없어 실제로는 신뢰할 수 없었다(테스트로 확인).
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
}): Promise<{ ok: boolean; title?: string; articleId?: string; error?: string }> {
  const sectionCount = 6;
  const imageCount = 4;
  const startedAt = Date.now();
  // maxDuration(280초)에 걸려 하드킬당하면 status가 'generating'에 영원히
  // 갇힌다 — 그게 이 전체 작업에서 가장 나쁜 결말이므로, 언어 몇 개를 못
  // 채우더라도 이 시간 안에는 반드시 pending_review로 마무리한다.
  const deadline = startedAt + 220_000;

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
        const url = await fetchImageUrl(`${block.imgQuery} korea`);
        imagesDone++;
        await notify({ phase: 'images', current: imagesDone, total: totalImages });
        if (url) resolvedBody.push({ img: url });
        continue;
      }
      resolvedBody.push(block);
    }
    // Unsplash는 한국어 검색어에서 결과가 0건인 경우가 많다(실측: "비빔밥
    // korea" 0건, "bibimbap korea" 35건) — 항상 영문인 slug로 검색한다.
    const heroImageUrl = await fetchImageUrl(`${slug.replace(/-/g, ' ')} korea`);
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

    // 언어를 동시에 다 돌리면(10개 언어 x 블록마다 병렬 호출) DeepL이 "Too many
    // requests"로 대부분 거절한다 — 실측: 160개 동시 요청 중 138개 실패.
    // 언어는 하나씩 순서대로 처리하고, 한 언어 안에서는 병렬로 번역한다.
    let translatedCount = 0;
    await notify({ phase: 'translating', current: 0, total: PRIORITY_LANGS.length });
    const translator = new deepl.Translator(process.env.DEEPL_API_KEY!);
    // DeepL 크레딧이 90% 이상 소진된 상태면 이번 글의 번역은 전부 Claude로 돌린다.
    const engineKind = await pickTranslationEngine(translator);
    const engine: TranslationEngine =
      engineKind === 'deepl' ? { kind: 'deepl', translator } : { kind: 'claude', anthropic };
    for (const { code, deepl: deeplCode, label } of PRIORITY_LANGS) {
      if (Date.now() > deadline) break; // 남은 언어는 건너뛰고 지금까지 된 것만으로 마무리한다.
      try {
        // DeepL이 가끔 한 언어에서만 계속 느리거나 막힐 때, 그 한 언어 때문에
        // 남은 예산을 전부 태우고 행이 영영 'generating'에 갇히는 걸 막는다.
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('language translation timed out')), 45000)
        );
        // title/excerpt/블록을 전부 순차로 번역한다 — 동시에 쏘면(Promise.all)
        // 몇 번 성공하다가 DeepL이 한동안 요청 전체를 막아버리는 걸 실측으로
        // 확인했다(백필 스크립트: 65개 중 62개 연쇄 timeout, 순차 처리로는 69/69
        // 전부 성공). translateText가 호출 사이에 자체적으로 300ms씩 쉰다.
        const translateAll = async () => {
          const title = await translateText(draft.title, engine, deeplCode, label);
          const excerpt = await translateText(draft.excerpt, engine, deeplCode, label);
          const body: Block[] = [];
          for (const block of resolvedBody) {
            body.push(await translateBlock(block, engine, deeplCode, label));
          }
          return [title, excerpt, body] as const;
        };
        const [title, excerpt, body] = await Promise.race([translateAll(), timeout]);

        await supabaseAdmin.from('article_translations').insert({
          article_id: articleId,
          lang: code,
          title,
          excerpt,
          body,
          is_machine_translated: true,
        });
      } catch {
        // 이 언어는 건너뛴다 — 한국어 원고는 이미 저장되어 있으니 리뷰는 가능하다.
      } finally {
        translatedCount++;
        await notify({ phase: 'translating', current: translatedCount, total: PRIORITY_LANGS.length });
      }
    }

    await supabaseAdmin
      .from('articles')
      .update({ status: 'pending_review', progress_phase: 'done', progress_current: null, progress_total: null })
      .eq('id', articleId);

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
