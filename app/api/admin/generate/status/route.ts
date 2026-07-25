import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

function isAuthed() {
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id는 필수입니다' }, { status: 400 });

  const { data: article, error } = await supabaseAdmin
    .from('articles')
    .select('status, progress_phase, progress_current, progress_total, error')
    .eq('id', id)
    .maybeSingle();

  if (error || !article) {
    return NextResponse.json({ error: error?.message ?? '글을 찾을 수 없습니다' }, { status: 404 });
  }

  if (article.status === 'pending_review') {
    const { data: translation } = await supabaseAdmin
      .from('article_translations')
      .select('title')
      .eq('article_id', id)
      .eq('lang', 'ko')
      .maybeSingle();
    return NextResponse.json({ ok: true, status: 'done', title: translation?.title });
  }

  if (article.status === 'failed') {
    return NextResponse.json({ ok: true, status: 'failed', error: article.error });
  }

  return NextResponse.json({
    ok: true,
    status: 'generating',
    phase: article.progress_phase,
    current: article.progress_current,
    total: article.progress_total,
  });
}
