import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

function isAuthed() {
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { status } = await req.json();
  if (!['published', 'draft', 'pending_review'].includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('articles').update({ status }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error: translationsError } = await supabaseAdmin
    .from('article_translations')
    .delete()
    .eq('article_id', params.id);
  if (translationsError) {
    return NextResponse.json({ error: translationsError.message }, { status: 500 });
  }

  const { error: articleError } = await supabaseAdmin
    .from('articles')
    .delete()
    .eq('id', params.id);
  if (articleError) {
    return NextResponse.json({ error: articleError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
