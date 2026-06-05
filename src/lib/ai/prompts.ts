import { createClient } from '@/lib/supabase/server';

const MINIMAL_FALLBACKS: Record<string, string> = {
  research: 'Query: {query}\nProduct context: {productContext}\nSource context: {sourceContext}',
  product_details: 'Schema: {schema}\nExisting: {existingData}\nMetadata: {pageMetadata}\nBody: {bodyText}',
  generate_description: 'Title: {title}\nCategory: {category}\nBrand: {brand}\nModel: {model_number}\nFeatures: {featureBlock}\nHSN: {hsnNote}\nColor: {accent_color}\nSummary: {hsnSummaryNote}',
  ai_query: 'Query: {rawQuery}\nContext: {contextData}',
  product_description: 'Tone: {tone}\nLength: {length}\nData: {productData}',
  ai_add: 'Note: {imageNote}\nInput: {rawInput}'
};

export async function getSystemPrompt(promptId: string): Promise<string> {
  // 1. Specific prompt env key
  const envKey = `AI_PROMPT_${promptId.toUpperCase()}`;
  if (process.env[envKey]) {
    return process.env[envKey]!;
  }

  // 2. Global public setting env fallback (could be JSON or single prompt string for 'research')
  if (process.env.NEXT_PUBLIC_AI_SYSTEM_PROMPT) {
    try {
      const parsed = JSON.parse(process.env.NEXT_PUBLIC_AI_SYSTEM_PROMPT);
      if (parsed && typeof parsed === 'object' && parsed[promptId]) {
        return String(parsed[promptId]);
      }
    } catch {
      // If it isn't a JSON, treat as default research prompt
      if (promptId === 'research') {
        return process.env.NEXT_PUBLIC_AI_SYSTEM_PROMPT;
      }
    }
  }

  // 3. Database setting table lookup
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', `ai_prompt_${promptId}`)
      .single();
    if (data?.value && typeof data.value === 'string') {
      return data.value;
    }
  } catch {
    // Ignore db fetch failures and fall through
  }

  // 4. Fallback code minimal variables mapping (no long prompts)
  return MINIMAL_FALLBACKS[promptId] || '';
}

