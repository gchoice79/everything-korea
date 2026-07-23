import type { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { locales } from '@/i18n/routing';

const BASE_URL = 'https://everything-korea.vercel.app';

function languageAlternates(path: string) {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = `${BASE_URL}/${l}${path}`;
  return languages;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: categories } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('is_live', true);

  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('category_id, slug, created_at')
    .eq('status', 'published');

  const entries: MetadataRoute.Sitemap = [];

  for (const l of locales) {
    entries.push({
      url: `${BASE_URL}/${l}`,
      changeFrequency: 'daily',
      priority: 1,
      alternates: { languages: languageAlternates('') },
    });
  }

  for (const c of categories ?? []) {
    for (const l of locales) {
      entries.push({
        url: `${BASE_URL}/${l}/${c.id}`,
        changeFrequency: 'daily',
        priority: 0.8,
        alternates: { languages: languageAlternates(`/${c.id}`) },
      });
    }
  }

  for (const a of articles ?? []) {
    for (const l of locales) {
      entries.push({
        url: `${BASE_URL}/${l}/${a.category_id}/${a.slug}`,
        lastModified: a.created_at,
        changeFrequency: 'weekly',
        priority: 0.6,
        alternates: { languages: languageAlternates(`/${a.category_id}/${a.slug}`) },
      });
    }
  }

  return entries;
}
