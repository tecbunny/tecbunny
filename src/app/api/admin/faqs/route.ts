import { NextRequest } from 'next/server';
import { APIResponseBuilder } from '@/lib/api-response';
import { requireApiRole } from '@/lib/server-role-guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authResult = await requireApiRole({ allowedRoles: ['admin'] });
    if ('error' in authResult) {
      return authResult.error;
    }

    const { supabase } = authResult;

    const { data: faqs, error } = await supabase
      .from('faqs')
      .select('*')
      .order('category', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      return APIResponseBuilder.internalServerError('Failed to fetch FAQs for admin', {
        error: error.message,
      });
    }

    return APIResponseBuilder.success({ faqs });
  } catch (error: any) {
    return APIResponseBuilder.internalServerError('An unexpected error occurred while fetching admin FAQs', {
      error: error.message,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireApiRole({ allowedRoles: ['admin'] });
    if ('error' in authResult) {
      return authResult.error;
    }

    const { supabase } = authResult;
    const body = await request.json();
    const { category, question, answer, display_order, is_published } = body;

    if (!category || !question || !answer) {
      return APIResponseBuilder.badRequest('Category, question, and answer are required.');
    }

    const { data: faq, error } = await supabase
      .from('faqs')
      .insert([
        {
          category,
          question,
          answer,
          display_order: display_order ?? 0,
          is_published: is_published ?? true,
        },
      ])
      .select()
      .single();

    if (error) {
      return APIResponseBuilder.internalServerError('Failed to create FAQ', {
        error: error.message,
      });
    }

    return APIResponseBuilder.created({ faq, message: 'FAQ created successfully' });
  } catch (error: any) {
    return APIResponseBuilder.internalServerError('An unexpected error occurred while creating FAQ', {
      error: error.message,
    });
  }
}
