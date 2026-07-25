import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as deepl from 'deepl-node';
import { supabaseAdmin } from '@/lib/supabase-admin';

function isAuthed() {
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

type UsageRow = { tokens_in: number | null; tokens_out: number | null; created_at: string };

function sumTokens(rows: UsageRow[]) {
  return rows.reduce(
    (acc, r) => ({ in: acc.in + (r.tokens_in ?? 0), out: acc.out + (r.tokens_out ?? 0) }),
    { in: 0, out: 0 }
  );
}

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayStart = new Date(`${kst.toISOString().slice(0, 10)}T00:00:00+09:00`).toISOString();
  const monthStart = new Date(
    `${kst.toISOString().slice(0, 7)}-01T00:00:00+09:00`
  ).toISOString();

  const { data: allRows } = await supabaseAdmin
    .from('ai_usage_log')
    .select('tokens_in, tokens_out, created_at')
    .eq('provider', 'anthropic');

  const rows = (allRows ?? []) as UsageRow[];
  const claude = {
    today: sumTokens(rows.filter((r) => r.created_at >= todayStart)),
    month: sumTokens(rows.filter((r) => r.created_at >= monthStart)),
    allTime: sumTokens(rows),
  };

  let deeplUsage: { ok: true; used: number; limit: number } | { ok: false; error: string };
  try {
    const translator = new deepl.Translator(process.env.DEEPL_API_KEY!);
    const usage = await translator.getUsage();
    deeplUsage = {
      ok: true,
      used: usage.character?.count ?? 0,
      limit: usage.character?.limit ?? 0,
    };
  } catch (err) {
    deeplUsage = { ok: false, error: err instanceof Error ? err.message : '알 수 없는 오류' };
  }

  return NextResponse.json({ claude, deepl: deeplUsage });
}
