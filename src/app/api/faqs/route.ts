import { NextResponse } from 'next/server';
import { APIResponseBuilder } from '@/lib/api-response';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: faqs, error } = await supabase
      .from('faqs')
      .select('id, category, question, answer, display_order, is_published, created_at, updated_at')
      .eq('is_published', true)
      .order('category', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      return APIResponseBuilder.internalServerError('Failed to fetch FAQs', {
        error: error.message,
      });
    }

    const response = APIResponseBuilder.success({ faqs });
    response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return response;
  } catch (error: any) {
    return APIResponseBuilder.internalServerError('An unexpected error occurred while fetching FAQs', {
      error: error.message,
    });
  }
}
