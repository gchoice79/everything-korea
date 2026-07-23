import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const { articleId } = await req.json();
  if (!articleId) return NextResponse.json({ error: 'articleId required' }, { status: 400 });

  await supabaseAdmin.rpc('increment_views', { article_id: articleId });

  const { data } = await supabaseAdmin
    .from('articles')
    .select('views')
    .eq('id', articleId)
    .single();

  return NextResponse.json({ views: data?.views ?? 0 });
}
