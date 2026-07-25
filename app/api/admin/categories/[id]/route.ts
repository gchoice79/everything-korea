import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

function isAuthed() {
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { is_live, sort_order } = await req.json();
  const update: Record<string, unknown> = {};
  if (typeof is_live === 'boolean') update.is_live = is_live;
  if (Number.isFinite(sort_order)) update.sort_order = sort_order;

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('categories').update(update).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
