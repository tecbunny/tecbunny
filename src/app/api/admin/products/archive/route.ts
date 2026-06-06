/**
 * Product Archive / Soft Delete API
 * POST   /api/admin/products/archive           → Soft-delete (archive) a product
 * DELETE /api/admin/products/archive?id=...    → Same via DELETE verb
 * PUT    /api/admin/products/archive           → Restore an archived product
 *
 * This route calls the PostgreSQL RPCs deployed by migration
 * 20260603_soft_delete_and_archival.sql instead of issuing a hard DELETE.
 *
 * Historical safety guarantees:
 *   - product row is NEVER removed from the database
 *   - All FK references from orders, invoices, analytics remain intact
 *   - The stock_movements ledger is NOT affected (no orphaned entries)
 *   - A full JSONB snapshot is written to product_archive_log for forensics
 */

import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { createServiceClient, isSupabaseServiceConfigured, createClient } from '@/lib/supabase/server';
import { getSessionWithRole } from '@/lib/auth/server-role';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & schemas
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_ROLES = new Set(['admin', 'manager', 'superadmin']);

const archiveSchema = z.object({
  id: z.string().uuid('Product ID must be a valid UUID'),
  reason: z.string().max(500).optional().default('Administrative removal'),
});

const restoreSchema = z.object({
  id: z.string().uuid('Product ID must be a valid UUID'),
});

function getUuidAuditUserId(userId: string | undefined): string | null {
  if (!userId || userId === 'superadmin-root-id') return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    ? userId
    : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth + client helper
// ─────────────────────────────────────────────────────────────────────────────

async function getAdminClient(request: NextRequest) {
  const { supabase: authClient, session, role } = await getSessionWithRole(request);

  if (!session) {
    return { authError: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }
  if (!role || !ADMIN_ROLES.has(role)) {
    return { authError: NextResponse.json({ error: 'Forbidden – admin or manager role required' }, { status: 403 }) };
  }

  const supabase = isSupabaseServiceConfigured ? createServiceClient() : authClient ?? await createClient();
  return { supabase, session };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST – Archive (soft-delete) a product
// Body: { id: UUID, reason?: string }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const auth = await getAdminClient(request);
    if ('authError' in auth) return auth.authError;
    const { supabase, session } = auth;
    const auditUserId = getUuidAuditUserId(session.user.id);

    const body = await request.json().catch(() => ({}));
    const validation = archiveSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.format(), correlationId },
        { status: 400 }
      );
    }

    const { id, reason } = validation.data;

    logger.info('product_archive.soft_delete_start', { correlationId, productId: id, reason });

    // ── Call the atomic PostgreSQL archive function ────────────────────────────
    const { data: rpcResult, error: rpcError } = await supabase.rpc('soft_delete_product', {
      p_product_id: id,
      p_deleted_by: auditUserId,
      p_reason: reason,
    });

    if (rpcError) {
      logger.error('product_archive.rpc_failed', {
        correlationId, productId: id, error: rpcError.message, code: rpcError.code,
      });

      // Check if it's a business logic error (product already deleted, not found)
      if (rpcError.message?.includes('not found')) {
        return NextResponse.json(
          { error: 'Product not found', correlationId },
          { status: 404 }
        );
      }
      if (rpcError.message?.includes('already deleted')) {
        return NextResponse.json(
          { error: 'Product is already archived', correlationId },
          { status: 409 }
        );
      }

      // Fallback: direct status update if RPC doesn't exist yet
      logger.warn('product_archive.using_direct_fallback', { correlationId });

      const { data: fallbackResult, error: fallbackError } = await supabase
        .from('products')
        .update({
          is_deleted: true,
          status: 'archived',
          deleted_at: new Date().toISOString(),
          deleted_by: auditUserId,
          archived_at: new Date().toISOString(),
          archived_by: auditUserId,
          archive_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id, title, status, archived_at')
        .single();

      if (fallbackError) {
        return NextResponse.json(
          { error: 'Archive operation failed', details: fallbackError.message, correlationId },
          { status: 500 }
        );
      }

      logger.info('product_archive.fallback_success', { correlationId, productId: id });

      return NextResponse.json({
        success: true,
        method: 'direct_update',
        message: 'Product archived successfully (soft delete)',
        data: fallbackResult,
        correlationId,
      });
    }

    logger.info('product_archive.rpc_success', { correlationId, productId: id, result: rpcResult });

    return NextResponse.json({
      success: true,
      method: 'rpc',
      message: 'Product archived successfully (soft delete)',
      data: rpcResult,
      correlationId,
    }, { headers: { 'x-correlation-id': correlationId } });

  } catch (err: any) {
    logger.error('product_archive.unhandled', { correlationId, error: err.message });
    return NextResponse.json({ error: 'Internal server error', correlationId }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE – Same as POST but via DELETE verb (for REST convention)
// Query param: ?id=<product-uuid>
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const auth = await getAdminClient(request);
    if ('authError' in auth) return auth.authError;
    const { supabase, session } = auth;
    const auditUserId = getUuidAuditUserId(session.user.id);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const reason = searchParams.get('reason') || 'Administrative removal via DELETE';

    if (!id) {
      return NextResponse.json({ error: 'Product `id` query parameter is required', correlationId }, { status: 400 });
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc('soft_delete_product', {
      p_product_id: id,
      p_deleted_by: auditUserId,
      p_reason: reason,
    });

    if (rpcError) {
      // Fallback to direct update
      const { error: directError } = await supabase
        .from('products')
        .update({
          is_deleted: true,
          status: 'archived',
          deleted_at: new Date().toISOString(),
          deleted_by: auditUserId,
          archive_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (directError) {
        return NextResponse.json({ error: directError.message, correlationId }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        method: 'direct_fallback',
        message: 'Product soft-deleted',
        correlationId,
      });
    }

    return NextResponse.json({
      success: true,
      method: 'rpc',
      message: 'Product soft-deleted successfully',
      data: rpcResult,
      correlationId,
    });
  } catch (err: any) {
    logger.error('product_archive.delete_unhandled', { correlationId, error: err.message });
    return NextResponse.json({ error: 'Internal server error', correlationId }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT – Restore an archived product back to active status
// Body: { id: UUID }
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const auth = await getAdminClient(request);
    if ('authError' in auth) return auth.authError;
    const { supabase, session } = auth;
    const auditUserId = getUuidAuditUserId(session.user.id);

    const body = await request.json().catch(() => ({}));
    const validation = restoreSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.format(), correlationId },
        { status: 400 }
      );
    }

    const { id } = validation.data;

    logger.info('product_archive.restore_start', { correlationId, productId: id });

    const { data: rpcResult, error: rpcError } = await supabase.rpc('restore_product', {
      p_product_id: id,
      p_restored_by: auditUserId,
    });

    if (rpcError) {
      logger.warn('product_archive.restore_rpc_failed', { correlationId, error: rpcError.message });

      // Fallback: direct restore
      const { data: restored, error: directError } = await supabase
        .from('products')
        .update({
          is_deleted: false,
          status: 'active',
          deleted_at: null,
          deleted_by: null,
          archived_at: null,
          archived_by: null,
          archive_reason: null,
          updated_at: new Date().toISOString(),
          updated_by: auditUserId,
        })
        .eq('id', id)
        .select('id, title, status, updated_at')
        .single();

      if (directError) {
        return NextResponse.json({ error: directError.message, correlationId }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        method: 'direct_fallback',
        message: 'Product restored successfully',
        data: restored,
        correlationId,
      });
    }

    logger.info('product_archive.restore_success', { correlationId, productId: id });

    return NextResponse.json({
      success: true,
      method: 'rpc',
      message: 'Product restored to active catalog',
      data: rpcResult,
      correlationId,
    });
  } catch (err: any) {
    logger.error('product_archive.restore_unhandled', { correlationId, error: err.message });
    return NextResponse.json({ error: 'Internal server error', correlationId }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET – List archived products (admin audit view)
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const auth = await getAdminClient(request);
    if ('authError' in auth) return auth.authError;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('products')
      .select('id, title, name, category, status, archived_at, archived_by, archive_reason, updated_at', { count: 'exact' })
      .eq('is_deleted', true)
      .order('archived_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message, correlationId }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page, limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
      correlationId,
    });
  } catch (_err: any) {
    return NextResponse.json({ error: 'Internal server error', correlationId }, { status: 500 });
  }
}
