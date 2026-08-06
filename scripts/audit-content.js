const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const env = {};
fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  .split('\n')
  .forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: articles, error } = await sb
    .from('articles')
    .select('id, slug, category_id, status')
    .eq('status', 'published');
  if (error) throw error;

  const results = [];
  for (const a of articles) {
    const { data: tr } = await sb
      .from('article_translations')
      .select('body, title')
      .eq('article_id', a.id)
      .eq('lang', 'ko')
      .maybeSingle();
    if (!tr) {
      results.push({ slug: a.slug, category: a.category_id, error: 'NO_KO_TRANSLATION' });
      continue;
    }
    const body = tr.body || [];
    const headings = body.filter((b) => b.h).length;
    const paragraphs = body.filter((b) => b.p).length;
    const images = body.filter((b) => b.img).length;
    const totalChars = body.reduce((sum, b) => sum + (b.p ? b.p.length : 0), 0);
    results.push({ slug: a.slug, category: a.category_id, title: tr.title, headings, paragraphs, images, totalChars });
  }
  results.sort((x, y) => (x.totalChars || 0) - (y.totalChars || 0));
  console.log(JSON.stringify(results, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
