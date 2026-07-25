import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

function isAuthed() {
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

type Block = { h?: string; p?: string; img?: string };

async function searchImage(query: string, exclude: string[]): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    // 검색어에 맞는 사진이 거의 없으면 억지로 채우지 않고 건너뛴다.
    if (!data.results?.length || data.total < 3) return null;
    const pick = data.results?.find((r: { urls: { regular: string } }) => !exclude.includes(r.urls.regular));
    return pick?.urls?.regular ?? data.results?.[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { target, blockIndex } = (await req.json()) as {
    target: 'hero' | 'body';
    blockIndex?: number;
  };
  if (target === 'body' && typeof blockIndex !== 'number') {
    return NextResponse.json({ error: 'blockIndex는 필수입니다' }, { status: 400 });
  }

  const { data: article } = await supabaseAdmin
    .from('articles')
    .select('id, slug, image_url')
    .eq('id', params.id)
    .single();
  if (!article) return NextResponse.json({ error: '글을 찾을 수 없습니다' }, { status: 404 });

  const { data: koTr } = await supabaseAdmin
    .from('article_translations')
    .select('body')
    .eq('article_id', params.id)
    .eq('lang', 'ko')
    .single();

  // Unsplash는 영어 검색어에서 훨씬 정확한 결과를 준다 — 한국어 제목 대신
  // 항상 영문 slug를 쓰고 "korea"를 붙인다.
  const query = `${article.slug.replace(/-/g, ' ')} korea`;
  const body = (koTr?.body as Block[]) ?? [];
  const usedImages = [article.image_url, ...body.map((b) => b.img)].filter(Boolean) as string[];

  const newUrl = await searchImage(query, usedImages);
  if (!newUrl) {
    return NextResponse.json({ error: '새 사진을 찾지 못했습니다' }, { status: 500 });
  }

  if (target === 'hero') {
    await supabaseAdmin.from('articles').update({ image_url: newUrl }).eq('id', params.id);
    return NextResponse.json({ ok: true, url: newUrl });
  }

  const { data: rows } = await supabaseAdmin
    .from('article_translations')
    .select('lang, body')
    .eq('article_id', params.id);

  for (const row of rows ?? []) {
    const rowBody = row.body as Block[];
    if (!rowBody[blockIndex as number]?.img) continue;
    rowBody[blockIndex as number] = { img: newUrl };
    await supabaseAdmin
      .from('article_translations')
      .update({ body: rowBody })
      .eq('article_id', params.id)
      .eq('lang', row.lang);
  }

  return NextResponse.json({ ok: true, url: newUrl });
}
