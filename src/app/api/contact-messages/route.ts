import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createServiceClient, createClient as createServerClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { isAdmin } from '@/lib/permissions';
import type { ContactMessage, ContactMessageStatus } from '@/lib/types';

const CONTACT_RATE_LIMIT = {
  limit: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
};

const createMessageSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().min(5).max(160),
  phone: z.string().min(6).max(32).optional().or(z.literal('').transform(() => undefined)),
  subject: z.string().min(2).max(160).optional().or(z.literal('').transform(() => undefined)),
  message: z.string().min(10).max(5000),
});

const statusFilterSchema = z.object({
  status: z
    .union([z.enum(['New', 'In Progress', 'Resolved']), z.literal('all'), z.literal('ALL')])
    .optional()
    .transform(value => {
      if (!value) return undefined;
      return value.toLowerCase() === 'all' ? undefined : value;
    }),
  limit: z
    .string()
    .transform(value => Number.parseInt(value, 10))
    .pipe(z.number().min(1).max(200))
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const submissionIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
    if (!rateLimit(submissionIp, 'contact_messages_post', CONTACT_RATE_LIMIT)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await request.json();
    const parsed = createMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const serviceSupabase = createServiceClient();
    const payload = {
      name: parsed.data.name.trim(),
      email: parsed.data.email.trim().toLowerCase(),
      phone: parsed.data.phone?.trim() || null,
      subject: parsed.data.subject?.trim() || null,
      message: parsed.data.message.trim(),
      status: 'New' as ContactMessageStatus,
      ip_address: submissionIp === 'anonymous' ? null : submissionIp,
    };

    const { data, error } = await serviceSupabase
      .from('contact_messages')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      logger.error('contact_message_insert_failed', { error: error.message });
      return NextResponse.json({ error: 'Failed to submit message' }, { status: 500 });
    }

    logger.info('contact_message_created', { messageId: data?.id, ip: submissionIp });

    return NextResponse.json({ success: true, id: data?.id }, { status: 201 });
  } catch (error) {
    logger.error('contact_message_post_unexpected', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const isUserAdmin = await isAdmin(auth.user);
    if (!isUserAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsedFilters = statusFilterSchema.safeParse(params);

    if (!parsedFilters.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const serviceSupabase = createServiceClient();
    let query = serviceSupabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (parsedFilters.data.status) {
      query = query.eq('status', parsedFilters.data.status as ContactMessageStatus);
    }

    if (parsedFilters.data.limit) {
      query = query.limit(parsedFilters.data.limit);
    } else {
      query = query.limit(100);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('contact_message_list_failed', { error: error.message });
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
    }

    return NextResponse.json({ data: (data ?? []) as ContactMessage[] });
  } catch (error) {
    logger.error('contact_message_get_unexpected', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
