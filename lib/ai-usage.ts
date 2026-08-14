import { supabaseAdmin } from '@/lib/supabase-admin';

export async function logClaudeUsage(
  purpose: 'suggest_topic' | 'generate_article' | 'chat' | 'translate',
  usage: { input_tokens: number; output_tokens: number },
  model?: string
) {
  try {
    await supabaseAdmin.from('ai_usage_log').insert({
      provider: 'anthropic',
      purpose,
      tokens_in: usage.input_tokens,
      tokens_out: usage.output_tokens,
      model: model ?? null,
    });
  } catch {
    // usage logging must never break generation/chat
  }
}
