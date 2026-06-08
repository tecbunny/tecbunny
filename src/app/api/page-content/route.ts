import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { AdminAuthError, requireAdminContext } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';

const PUBLIC_PAGE_CONTENT_CACHE_CONTROL = 'no-store, max-age=0';
const PAGE_CONTENT_PUBLIC_SELECTS = {
  pageKeyStatus: 'id,page_key,title,content,status,meta_description,meta_keywords,created_at,updated_at',
  keyStatus: 'id,key,title,content,status,meta_description,meta_keywords,created_at,updated_at',
  keyActive: 'id,key,title,content,is_active,meta_description,meta_keywords,created_at,updated_at',
  pageKeyMinimal: 'id,page_key,title,content,created_at,updated_at',
  keyMinimal: 'id,key,title,content,created_at,updated_at',
};

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Use service role if available, else anon for read operations (GET)
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey);
}

function isFetchFailure(err: any) {
  if (!err) return false;
  const message = String(err.message || '').toLowerCase();
  return message.includes('fetch failed');
}

function isUndefinedColumn(err: any) {
  if (!err) return false;
  const code = String(err.code || '');
  const combined = `${err.message || ''} ${err.hint || ''} ${err.details || ''}`.toLowerCase();
  return (
    code === '42703' ||
    /^pgrst\d+$/i.test(code) && (
      combined.includes('schema cache') ||
      combined.includes('could not find') ||
      combined.includes('does not exist') ||
      combined.includes('unknown column')
    ) ||
    /column .* does not exist/i.test(combined)
  );
}

function normalizePage(row: any | null) {
  if (!row) return null;
  const page_key = row.page_key ?? row.key ?? null;
  const status = row.status ?? (row.is_active === true ? 'published' : row.is_active === false ? 'draft' : undefined);
  let content = row.content ?? row.data ?? null;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch (_error) {
      // leave as string
    }
  }
  return { ...row, page_key, status, content };
}

function jsonWithCache(body: unknown, cacheControl: string, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', cacheControl);
  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

function parseContentValue(content: unknown) {
  if (typeof content === 'string') {
    try {
      return JSON.parse(content);
    } catch (_error) {
      throw new Error('Invalid JSON content payload');
    }
  }
  return content;
}

interface ContentPayload {
  pageKey: string;
  title: string;
  content: any;
  metaDescription: string | null;
  metaKeywords: string | null;
  status: string;
}

function extractPayload(body: any): ContentPayload {
  const pageKey = body?.pageKey || body?.page_key || body?.key;
  const title = body?.title;
  const metaDescription = body?.metaDescription ?? body?.meta_description ?? null;
  const metaKeywords = body?.metaKeywords ?? body?.meta_keywords ?? null;
  const status = body?.status || 'published';

  if (!pageKey || !title || body?.content == null) {
    throw new Error('Page key, title, and content are required');
  }

  const content = parseContentValue(body.content);

  return { pageKey, title, content, metaDescription, metaKeywords, status };
}

async function upsertPageContent(supabase: any, payload: ContentPayload) {
  const timestamp = new Date().toISOString();

  const strategies: Array<{
    data: Record<string, any>;
    conflict: 'page_key' | 'key';
    select: 'single' | 'maybeSingle';
  }> = [
    {
      data: {
        page_key: payload.pageKey,
        title: payload.title,
        content: payload.content,
        meta_description: payload.metaDescription,
        meta_keywords: payload.metaKeywords,
        status: payload.status,
        updated_at: timestamp
      },
      conflict: 'page_key',
      select: 'single'
    },
    {
      data: {
        page_key: payload.pageKey,
        title: payload.title,
        content: payload.content,
        status: payload.status,
        updated_at: timestamp
      },
      conflict: 'page_key',
      select: 'single'
    },
    {
      data: {
        key: payload.pageKey,
        title: payload.title,
        content: payload.content,
        meta_description: payload.metaDescription,
        meta_keywords: payload.metaKeywords,
        updated_at: timestamp
      },
      conflict: 'key',
      select: 'maybeSingle'
    },
    {
      data: {
        key: payload.pageKey,
        title: payload.title,
        content: payload.content,
        updated_at: timestamp
      },
      conflict: 'key',
      select: 'maybeSingle'
    }
  ];

  let lastResult: any = null;

  for (const strategy of strategies) {
    const baseQuery = supabase
      .from('page_content')
      .upsert(strategy.data, { onConflict: strategy.conflict })
      .select();

    const result = strategy.select === 'single'
      ? await baseQuery.single()
      : await baseQuery.maybeSingle();
    lastResult = result;

    if (!result.error) {
      return result;
    }

    if (!isUndefinedColumn(result.error)) {
      return result;
    }
  }

  return lastResult;
}

async function getPageByKey(pageKey: string, supabase: any) {
  // Try a sequence of strategies to accommodate different schemas
  const tries: Array<() => PromiseLike<any>> = [
    // Modern: page_key + status
    () => supabase.from('page_content').select(PAGE_CONTENT_PUBLIC_SELECTS.pageKeyStatus).eq('page_key', pageKey).eq('status', 'published').maybeSingle(),
    // Mixed: key + status
    () => supabase.from('page_content').select(PAGE_CONTENT_PUBLIC_SELECTS.keyStatus).eq('key', pageKey).eq('status', 'published').maybeSingle(),
    // Legacy: key + is_active
    () => supabase.from('page_content').select(PAGE_CONTENT_PUBLIC_SELECTS.keyActive).eq('key', pageKey).eq('is_active', true).maybeSingle(),
    // Minimal: page_key only
    () => supabase.from('page_content').select(PAGE_CONTENT_PUBLIC_SELECTS.pageKeyMinimal).eq('page_key', pageKey).maybeSingle(),
    // Minimal legacy: key only
    () => supabase.from('page_content').select(PAGE_CONTENT_PUBLIC_SELECTS.keyMinimal).eq('key', pageKey).maybeSingle(),
  ];

  for (const run of tries) {
  const { data, error } = await run();
    if (!error) return { data, error: null };
    if (isUndefinedColumn(error)) {
      continue;
    }
    // Non-undefined-column error: stop and surface it
    return { data: null, error };
  }
  // Only undefined-column errors encountered: treat as not found (no 500)
  return { data: null, error: null };
}

// Get page content by key
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const pageKey = searchParams.get('key');

    if (!pageKey) {
      return NextResponse.json({ error: 'Page key is required' }, { status: 400 });
    }

    if (!supabase) {
      logger.warn('page_content_supabase_not_configured', { pageKey });
      return jsonWithCache({ success: true, data: null, warning: 'Supabase not configured' }, PUBLIC_PAGE_CONTENT_CACHE_CONTROL);
    }
    const { data: pageContent, error } = await getPageByKey(pageKey, supabase);

    if (error) {
      if (isFetchFailure(error)) {
        logger.warn('page_content_fetch_failed', { error, pageKey });
        return jsonWithCache({ success: true, data: null, warning: 'Content service unavailable' }, PUBLIC_PAGE_CONTENT_CACHE_CONTROL);
      }
      logger.error('page_content_fetch_failed', { error, pageKey });
      return NextResponse.json({ error: 'Failed to fetch page content' }, { status: 500 });
    }

    // Return 200 with null data when not found; normalize field names
    return jsonWithCache({ success: true, data: normalizePage(pageContent ?? null) }, PUBLIC_PAGE_CONTENT_CACHE_CONTROL);

  } catch (error) {
  logger.error('page_content_api_error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update page content (admin only)
export async function PUT(request: NextRequest) {
  try {
    const { serviceSupabase: supabase } = await requireAdminContext();

    const body = await request.json();
    let payload: ContentPayload;
    try {
      payload = extractPayload(body);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }

    const upsert = await upsertPageContent(supabase, payload);

    if (upsert.error) {
      logger.error('page_content_update_failed', { error: upsert.error, payload });
      return NextResponse.json({
        error: upsert.error.message || 'Failed to update page content',
        details: upsert.error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Page content updated successfully',
      data: normalizePage(upsert.data)
    });

  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('page_content_update_exception', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get all page contents (admin only)
export async function POST(request: NextRequest) {
  try {
    const { serviceSupabase: supabase } = await requireAdminContext();

    const body = await request.json();

    if (body?.action === 'list_all') {

      // Get all page contents, try modern order then legacy
      let { data: pages, error } = await supabase
        .from('page_content')
        .select('*')
        .order('page_key');

      if (error && isUndefinedColumn(error)) {
        const fallback = await supabase
          .from('page_content')
          .select('*')
          .order('key');
        pages = fallback.data || [];
        error = fallback.error;

        if (error && isUndefinedColumn(error)) {
          // Final fallback: no order
          const noOrder = await supabase
            .from('page_content')
            .select('*');
          pages = noOrder.data || [];
          error = noOrder.error;
        }
      }

      if (error) {
        logger.error('page_content_list_failed', { error });
        return NextResponse.json({ error: 'Failed to fetch page contents' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: (pages || []).map(normalizePage)
      });
    }

    let payload: ContentPayload;
    try {
      payload = extractPayload(body);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    const upsert = await upsertPageContent(supabase, payload);

    if (upsert.error) {
      logger.error('page_content_create_failed', { error: upsert.error, payload });
      return NextResponse.json({
        error: upsert.error.message || 'Failed to save page content',
        details: upsert.error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Page content saved successfully',
      data: normalizePage(upsert.data)
    }, { status: 201 });

  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('page_content_list_exception', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { serviceSupabase: supabase } = await requireAdminContext();

    const url = new URL(request.url);
    let pageKey = url.searchParams.get('key') || url.searchParams.get('pageKey');

    if (!pageKey) {
      try {
        const body = await request.json();
        pageKey = body?.pageKey || body?.page_key || body?.key || null;
      } catch (_error) {
        // ignore body parse errors for DELETE without payload
      }
    }

    if (!pageKey) {
      return NextResponse.json({ error: 'Page key is required' }, { status: 400 });
    }

    const attempts: Array<'page_key' | 'key'> = ['page_key', 'key'];
    let removed = false;
    let lastError: any = null;

    for (const column of attempts) {
      try {
        const { data, error } = await supabase
          .from('page_content')
          .delete()
          .eq(column, pageKey)
          .select()
          .maybeSingle();

        if (error) {
          if (isUndefinedColumn(error)) {
            continue;
          }
          lastError = error;
          break;
        }

        if (data) {
          removed = true;
          break;
        }
      } catch (error) {
        lastError = error;
        break;
      }
    }

    if (lastError) {
      logger.error('page_content_delete_failed', { error: lastError, pageKey });
      return NextResponse.json({ error: 'Failed to delete page content' }, { status: 500 });
    }

    if (!removed) {
      return NextResponse.json({ error: 'Page content not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Page content deleted successfully' });

  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('page_content_delete_exception', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
