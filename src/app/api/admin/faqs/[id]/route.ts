import { NextRequest } from 'next/server';
import { APIResponseBuilder } from '@/lib/api-response';
import { requireApiRole } from '@/lib/server-role-guard';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireApiRole({ allowedRoles: ['admin'] });
    if ('error' in authResult) {
      return authResult.error;
    }

    const { supabase } = authResult;
    const { id } = await params;

    if (!id) {
      return APIResponseBuilder.badRequest('FAQ ID is required');
    }

    const body = await request.json();
    const { category, question, answer, display_order, is_published } = body;

    // Build update payload dynamically
    const updatePayload: Record<string, any> = {};
    if (category !== undefined) updatePayload.category = category;
    if (question !== undefined) updatePayload.question = question;
    if (answer !== undefined) updatePayload.answer = answer;
    if (display_order !== undefined) updatePayload.display_order = display_order;
    if (is_published !== undefined) updatePayload.is_published = is_published;

    if (Object.keys(updatePayload).length === 0) {
      return APIResponseBuilder.badRequest('No fields provided for update');
    }

    const { data: faq, error } = await supabase
      .from('faqs')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return APIResponseBuilder.internalServerError('Failed to update FAQ', {
        error: error.message,
      });
    }

    return APIResponseBuilder.success({ faq, message: 'FAQ updated successfully' });
  } catch (error: any) {
    return APIResponseBuilder.internalServerError('An unexpected error occurred while updating FAQ', {
      error: error.message,
    });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireApiRole({ allowedRoles: ['admin'] });
    if ('error' in authResult) {
      return authResult.error;
    }

    const { supabase } = authResult;
    const { id } = await params;

    if (!id) {
      return APIResponseBuilder.badRequest('FAQ ID is required');
    }

    const { error } = await supabase
      .from('faqs')
      .delete()
      .eq('id', id);

    if (error) {
      return APIResponseBuilder.internalServerError('Failed to delete FAQ', {
        error: error.message,
      });
    }

    return APIResponseBuilder.success({ message: 'FAQ deleted successfully' });
  } catch (error: any) {
    return APIResponseBuilder.internalServerError('An unexpected error occurred while deleting FAQ', {
      error: error.message,
    });
  }
}
