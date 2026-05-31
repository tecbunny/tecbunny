import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createServiceClient, createClient as createServerClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import type { ContactMessage } from '@/lib/types';

const updateMessageSchema = z.object({
  status: z.enum(['New', 'In Progress', 'Resolved']).optional(),
  admin_notes: z
    .string()
    .max(2000)
    .transform(value => value.trim())
    .optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Missing message id' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const isUserAdmin = await isAdmin(auth.user);
    if (!isUserAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = await request.json();
    const parsed = updateMessageSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    if (!parsed.data.status && typeof parsed.data.admin_notes === 'undefined') {
      return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
    }

    const adminDisplayName =
      (auth.user.user_metadata?.full_name as string | undefined)?.trim() || auth.user.email || auth.user.id;

    const updateData: Record<string, unknown> = {
      handled_by: auth.user.id,
      handled_by_name: adminDisplayName,
    };

    if (typeof parsed.data.admin_notes !== 'undefined') {
      updateData.admin_notes = parsed.data.admin_notes.length > 0 ? parsed.data.admin_notes : null;
    }

    if (parsed.data.status) {
      updateData.status = parsed.data.status;
      updateData.resolved_at = parsed.data.status === 'Resolved' ? new Date().toISOString() : null;
    }

    const serviceSupabase = createServiceClient();
    const { data, error } = await serviceSupabase
      .from('contact_messages')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      logger.error('contact_message_update_failed', { error: error.message, id });
      return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
    }

    return NextResponse.json({ data: data as ContactMessage });
  } catch (error) {
    logger.error('contact_message_patch_unexpected', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}

export async function generateStaticParams() {
  return []
}

export async function GET() { return Response.json({}) }



