import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateArticle } from '@/lib/generate-article';

function isAuthed() {
  return cookies().get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

const SYSTEM_PROMPT = `너는 "Everything Korea" 사이트 전용 관리자 어시스턴트야. 이 사이트는 한국 관련 콘텐츠(음식, 문화 등)를 여러 언어로 제공하는 서비스고, AI가 글을 쓰고 사람이 검토 후 발행해.

규칙:
- 오직 이 사이트의 운영, 콘텐츠, 카테고리, 글 목록, 방문자 통계, 글 생성/발행 같은 주제만 다뤄. 사이트와 무관한 일반 지식 질문이나 잡담에는 "이 사이트 운영과 관련된 것만 도와드릴 수 있어요"라고 답하고 넘어가.
- 사용할 수 있는 도구(list_categories, list_articles, get_stats, generate_article, publish_article)로 실제 데이터를 확인하거나 작업을 실행해. 추측하지 말고 도구로 확인해.
- 글 생성이나 발행처럼 결과가 바로 반영되는 작업은 실행 전에 사용자에게 어떤 작업을 할지 한 줄로 확인받고 진행해.
- 답변은 간결하고 실용적으로.`;

const tools: Anthropic.Tool[] = [
  {
    name: 'list_categories',
    description: '사이트의 카테고리 목록(id, 공개 여부, 한국어 이름)을 가져온다.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_articles',
    description: '모든 글 목록(id, slug, category_id, status, 한국어 제목)을 가져온다.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_stats',
    description: '오늘 방문자 수와 누적 방문자 수를 가져온다.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'generate_article',
    description: '새 글을 AI로 작성해서 검토 대기(pending_review) 상태로 저장한다.',
    input_schema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: '글 주제 (예: 김치찌개, 한복)' },
        slug: { type: 'string', description: 'URL slug, 영문 소문자와 하이픈만' },
        category: { type: 'string', description: '카테고리 id (예: food, culture)' },
      },
      required: ['topic', 'slug', 'category'],
    },
  },
  {
    name: 'publish_article',
    description: '검토 대기 중인 글을 발행(published)한다.',
    input_schema: {
      type: 'object',
      properties: {
        articleId: { type: 'string', description: '발행할 글의 id' },
      },
      required: ['articleId'],
    },
  },
];

async function runTool(name: string, input: Record<string, unknown>) {
  switch (name) {
    case 'list_categories': {
      const { data } = await supabaseAdmin
        .from('categories')
        .select('id, is_live, category_names(lang, name)');
      return data;
    }
    case 'list_articles': {
      const { data: articles } = await supabaseAdmin
        .from('articles')
        .select('id, slug, category_id, status');
      if (!articles) return [];
      const { data: translations } = await supabaseAdmin
        .from('article_translations')
        .select('article_id, lang, title')
        .eq('lang', 'ko');
      return articles.map((a) => ({
        ...a,
        title: translations?.find((t) => t.article_id === a.id)?.title ?? null,
      }));
    }
    case 'get_stats': {
      const now = new Date();
      const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const todayStart = new Date(`${kst.toISOString().slice(0, 10)}T00:00:00+09:00`).toISOString();
      const { count: today } = await supabaseAdmin
        .from('site_visits')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart);
      const { count: total } = await supabaseAdmin
        .from('site_visits')
        .select('*', { count: 'exact', head: true });
      return { today: today ?? 0, total: total ?? 0 };
    }
    case 'generate_article': {
      const { topic, slug, category } = input as { topic: string; slug: string; category: string };
      return await generateArticle({ topic, slug, category });
    }
    case 'publish_article': {
      const { articleId } = input as { articleId: string };
      const { error } = await supabaseAdmin
        .from('articles')
        .update({ status: 'published' })
        .eq('id', articleId);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    default:
      return { error: 'unknown tool' };
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { messages } = await req.json();
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: 'messages는 필수입니다' }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const conversation: Anthropic.MessageParam[] = [...messages];

    for (let i = 0; i < 6; i++) {
      const res = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools,
        messages: conversation,
      });

      const toolUses = res.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );

      if (toolUses.length === 0) {
        const textBlock = res.content.find(
          (b): b is Anthropic.TextBlock => b.type === 'text'
        );
        return NextResponse.json({ reply: textBlock?.text ?? '' });
      }

      conversation.push({ role: 'assistant', content: res.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        const result = await runTool(use.name, use.input as Record<string, unknown>);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(result),
        });
      }
      conversation.push({ role: 'user', content: toolResults });
    }

    return NextResponse.json({ reply: '작업이 너무 길어져서 중단했어요. 다시 시도해주세요.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
