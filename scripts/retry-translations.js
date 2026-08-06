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

const SLUG = process.argv[2];
const LANGS = process.argv.slice(3).map((pair) => {
  const [code, deeplCode] = pair.split(':');
  return { code, deepl: deeplCode || code };
});

if (!SLUG || LANGS.length === 0) {
  console.error('사용법: node retry-translations.js <slug> <lang:deeplCode> [<lang:deeplCode> ...]');
  console.error('예: node retry-translations.js tteokbokki vi:vi pt:pt-BR');
  process.exit(1);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry(fn, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.log(`  재시도 ${i + 1}/${attempts} 실패: ${err && err.message ? err.message : String(err)}`);
      await wait(1500 * 2 ** i);
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

async function main() {
  const { data: article } = await sb.from('articles').select('id').eq('slug', SLUG).maybeSingle();
  if (!article) throw new Error(`글을 찾을 수 없음: ${SLUG}`);

  const { data: ko } = await sb
    .from('article_translations')
    .select('title, excerpt, body')
    .eq('article_id', article.id)
    .eq('lang', 'ko')
    .maybeSingle();
  if (!ko) throw new Error(`한국어 원문이 없음: ${SLUG}`);

  for (const { code, deepl: deeplCode } of LANGS) {
    console.log(`\n=== ${code} (${deeplCode}) ===`);
    const title = await translateText(ko.title, deeplCode);
    const excerpt = await translateText(ko.excerpt, deeplCode);
    const body = [];
    for (const block of ko.body) {
      body.push(await translateBlock(block, deeplCode));
    }
    await sb.from('article_translations').delete().eq('article_id', article.id).eq('lang', code);
    await sb.from('article_translations').insert({
      article_id: article.id,
      lang: code,
      title,
      excerpt,
      body,
      is_machine_translated: true,
    });
    console.log(`  ${code} 완료`);
  }

  console.log('\n모두 완료');
}

main().catch((err) => {
  console.error('스크립트 오류:', err);
  process.exit(1);
});
