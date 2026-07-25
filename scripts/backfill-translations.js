const fs = require('fs');
const path = require('path');
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

async function withRetry(fn, attempts = 4) {
  let lastErr;
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

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateText(text, targetLang) {
  const r = await withRetry(() => translator.translateText(text, 'ko', targetLang));
  await wait(300); // 요청 사이 간격 — 동시에 여러 개 쏘면 얼마 못 가 전부 막히는 걸 실측으로 확인했다.
  return r.text;
}

async function translateBlock(block, targetLang) {
  if (block.h) return { h: await translateText(block.h, targetLang) };
  if (block.p) return { p: await translateText(block.p, targetLang) };
  return block;
}

// 완전히 순차 처리한다 — title, excerpt, 그리고 body 블록을 하나씩. 한 언어
// 안에서조차 Promise.all로 동시에 쏘면(~18개) 몇 번 성공하다가 DeepL이 한동안
// 전체를 막아버려서(재시도/텀을 둬도 마찬가지) 오히려 다 순차로 도는 것보다
// 느려진다.
async function translateOneLang(articleId, koRow, code, deeplCode) {
  const title = await translateText(koRow.title, deeplCode);
  const excerpt = await translateText(koRow.excerpt, deeplCode);
  const body = [];
  for (const block of koRow.body) {
    body.push(await translateBlock(block, deeplCode));
  }
  await sb.from('article_translations').insert({
    article_id: articleId,
    lang: code,
    title,
    excerpt,
    body,
    is_machine_translated: true,
  });
}

async function main() {
  const { data: articles } = await sb
    .from('articles')
    .select('id, slug, status')
    .in('status', ['pending_review', 'published']);
  const { data: trans } = await sb.from('article_translations').select('article_id, lang');

  const byArticle = {};
  for (const t of trans) {
    (byArticle[t.article_id] ??= new Set()).add(t.lang);
  }

  const jobs = [];
  for (const a of articles) {
    const have = byArticle[a.id] ?? new Set();
    const missing = PRIORITY_LANGS.filter((l) => !have.has(l.code));
    for (const lang of missing) jobs.push({ article: a, lang });
  }

  console.log(`${jobs.length}개 번역 작업 시작 (${articles.length}개 글 중 대상)\n`);

  const koCache = {};
  let done = 0;
  let failed = 0;
  const failedList = [];

  for (const { article, lang } of jobs) {
    if (!koCache[article.id]) {
      const { data: koRow } = await sb
        .from('article_translations')
        .select('title, excerpt, body')
        .eq('article_id', article.id)
        .eq('lang', 'ko')
        .maybeSingle();
      koCache[article.id] = koRow;
    }
    const koRow = koCache[article.id];
    if (!koRow) {
      console.log(`[스킵] ${article.slug} — 한국어 원문 없음`);
      failed++;
      continue;
    }

    try {
      await translateOneLang(article.id, koRow, lang.code, lang.deepl);
      done++;
      console.log(`[완료 ${done}/${jobs.length}] ${article.slug} → ${lang.code}`);
    } catch (err) {
      failed++;
      failedList.push(`${article.slug} → ${lang.code} (${err.message})`);
      console.log(`[실패] ${article.slug} → ${lang.code}: ${err.message}`);
    }

    // 언어 작업 사이 짧은 텀 (블록 하나하나는 이미 순차 + 300ms 간격).
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n총 ${jobs.length}개 중 성공 ${done}개, 실패 ${failed}개`);
  if (failedList.length) {
    console.log('실패 목록:');
    failedList.forEach((f) => console.log(' -', f));
  }
}

main().catch((err) => {
  console.error('스크립트 오류:', err);
  process.exit(1);
});
