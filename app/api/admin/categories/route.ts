import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as deepl from 'deepl-node';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PRIORITY_LANGS, translateText } from '@/lib/generate-article';

function isAuthed() {
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('id, is_live, sort_order, category_names(lang, name)')
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ categories: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id, koName, sortOrder } = await req.json();
  if (!id || !/^[a-z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: 'id는 소문자/숫자/하이픈만 가능합니다.' }, { status: 400 });
  }
  if (!koName || typeof koName !== 'string') {
    return NextResponse.json({ error: '한국어 이름이 필요합니다.' }, { status: 400 });
  }

  const { error: catError } = await supabaseAdmin.from('categories').insert({
    id,
    is_live: false,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
  });
  if (catError) {
    const message = catError.code === '23505' ? '이미 존재하는 카테고리 id입니다.' : catError.message;
    return NextResponse.json({ error: message }, { status: catError.code === '23505' ? 409 : 500 });
  }

  await supabaseAdmin.from('category_names').insert({ category_id: id, lang: 'ko', name: koName });

  const translator = new deepl.Translator(process.env.DEEPL_API_KEY!);
  const failedLangs: string[] = [];
  for (const { code, deepl: deeplCode } of PRIORITY_LANGS) {
    try {
      const name = await translateText(koName, translator, deeplCode);
      await supabaseAdmin.from('category_names').insert({ category_id: id, lang: code, name });
    } catch {
      failedLangs.push(code);
    }
  }

  return NextResponse.json({ ok: true, ...(failedLangs.length ? { failedLangs } : {}) });
}
