import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

function isAuthed() {
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id, slug, category_id, status, image_url, created_at')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false });

  if (!articles || !articles.length) return NextResponse.json({ articles: [] });

  const { data: translations } = await supabaseAdmin
    .from('article_translations')
    .select('article_id, lang, title, excerpt, body')
    .in('article_id', articles.map((a) => a.id));

  const result = articles.map((a) => ({
    ...a,
    translations: translations?.filter((t) => t.article_id === a.id) ?? [],
  }));

  return NextResponse.json({ articles: result });
}
