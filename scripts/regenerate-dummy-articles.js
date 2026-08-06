const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const deepl = require('deepl-node');
const { createClient } = require('@supabase/supabase-js');

const env = {};
fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  .split('\n')
  .forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const translator = new deepl.Translator(env.DEEPL_API_KEY);

const PRIORITY_LANGS = [
  { code: 'en', deepl: 'en-US' },
  { code: 'ja', deepl: 'ja' },
  { code: 'zh', deepl: 'zh' },
  { code: 'hi', deepl: 'hi' },
  { code: 'es', deepl: 'es' },
  { code: 'fr', deepl: 'fr' },
  { code: 'ar', deepl: 'ar' },
  { code: 'id', deepl: 'id' },
  { code: 'vi', deepl: 'vi' },
  { code: 'pt', deepl: 'pt-BR' },
];

const TARGETS = [
  { slug: 'kimchi-jjigae', topic: '김치찌개' },
];

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry(fn, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await wait(1000 * 2 ** i);
    }
  }
  throw lastErr;
}

async function translateText(text, targetLang) {
  const r = await withRetry(() => translator.translateText(text, 'ko', targetLang));
  await wait(300);
  return r.text;
}

async function translateBlock(block, targetLang) {
  if (block.h) return { h: await translateText(block.h, targetLang) };
  if (block.p) return { p: await translateText(block.p, targetLang) };
  return block;
}

async function fetchImageUrl(query) {
  const key = env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results?.length || data.total < 3) return null;
    return data.results[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

async function writeArticle(topic, categoryName) {
  const sectionCount = 6;
  const imageCount = 4;
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

  const textBlock = res.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Claude 응답에서 텍스트를 찾지 못했습니다.');
  const cleaned = textBlock.text.trim().replace(/^```json\s*|\s*```$/g, '');
  return JSON.parse(cleaned);
}

async function main() {
  for (const { slug, topic } of TARGETS) {
    console.log(`\n=== ${slug} (${topic}) ===`);

    const { data: article } = await sb
      .from('articles')
      .select('id, category_id')
      .eq('slug', slug)
      .maybeSingle();
    if (!article) {
      console.log(`[스킵] ${slug} — 글을 찾을 수 없음`);
      continue;
    }

    const { data: categoryNameRow } = await sb
      .from('category_names')
      .select('name')
      .eq('category_id', article.category_id)
      .eq('lang', 'ko')
      .maybeSingle();
    const categoryName = categoryNameRow?.name ?? article.category_id;

    console.log('글쓰기 중...');
    const draft = await writeArticle(topic, categoryName);
    console.log('제목:', draft.title);

    console.log('이미지 검색 중...');
    const resolvedBody = [];
    for (const block of draft.body) {
      if (block.imgQuery) {
        const url = await fetchImageUrl(`${block.imgQuery} korea`);
        if (url) resolvedBody.push({ img: url });
        continue;
      }
      resolvedBody.push(block);
    }
    const heroImageUrl = await fetchImageUrl(`${topic} korea`);

    await sb.from('articles').update({ image_url: heroImageUrl }).eq('id', article.id);
    await sb.from('article_translations').delete().eq('article_id', article.id);
    await sb.from('article_translations').insert({
      article_id: article.id,
      lang: 'ko',
      title: draft.title,
      excerpt: draft.excerpt,
      body: resolvedBody,
      is_machine_translated: false,
    });

    console.log('번역 중...');
    for (const { code, deepl: deeplCode } of PRIORITY_LANGS) {
      try {
        const title = await translateText(draft.title, deeplCode);
        const excerpt = await translateText(draft.excerpt, deeplCode);
        const body = [];
        for (const block of resolvedBody) {
          body.push(await translateBlock(block, deeplCode));
        }
        await sb.from('article_translations').insert({
          article_id: article.id,
          lang: code,
          title,
          excerpt,
          body,
          is_machine_translated: true,
        });
        console.log(`  ${code} 완료`);
      } catch (err) {
        console.log(`  ${code} 실패: ${err.message}`);
      }
      await wait(1000);
    }

    console.log(`${slug} 완료`);
  }

  console.log('\n모두 완료');
}

main().catch((err) => {
  console.error('스크립트 오류:', err);
  process.exit(1);
});
