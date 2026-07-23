import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function kstTodayStart(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = kst.toISOString().slice(0, 10);
  return new Date(`${dateStr}T00:00:00+09:00`).toISOString();
}

export async function POST() {
  await supabaseAdmin.from('site_visits').insert({});

  const { count: today } = await supabaseAdmin
    .from('site_visits')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', kstTodayStart());

  const { count: total } = await supabaseAdmin
    .from('site_visits')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({ today: today ?? 0, total: total ?? 0 });
}
