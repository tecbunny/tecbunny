import { NextRequest, NextResponse } from 'next/server';

import { buildCustomSetupBlueprintSummary } from '@/lib/custom-setup-service';
import { AdminAuthError, requireAdminContext } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import { DEFAULT_CUSTOM_SETUP_TEMPLATE_SLUG } from '@/lib/custom-setup.constants';

// export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchTemplateWithDetails(serviceSupabase: Awaited<ReturnType<typeof requireAdminContext>>['serviceSupabase'], slug: string) {
  const { data, error } = await serviceSupabase
    .from('custom_setup_templates')
    .select(`
      id,
      slug,
      name,
      description,
      category,
      hero_copy,
      base_price,
      currency,
      metadata,
      systems:custom_setup_systems(
        id,
        slug,
        name,
        description,
        sort_order,
        base_fee,
        pricing_formula,
        metadata,
        is_default,
        components:custom_setup_components(
          id,
          slug,
          name,
          description,
          category,
          is_required,
          min_quantity,
          max_quantity,
          default_quantity,
          quantity_variable,
          pricing_mode,
          base_price,
          unit_price,
          price_formula,
          metadata,
          sort_order,
          options:custom_setup_component_options(
            id,
            label,
            value,
            description,
            is_default,
            unit_price,
            metadata
          )
        )
      ),
      variables:custom_setup_variables(
        id,
        key,
        label,
        input_type,
        description,
        min_value,
        max_value,
        step_value,
        default_value,
        metadata
      )
    `)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    logger.error('admin_custom_setups.fetch_template_failed', {
      slug,
      error: error.message,
      code: error.code,
    });
    throw error;
  }

  return data;
}

export async function GET(request: NextRequest) {
  try {
    const { serviceSupabase } = await requireAdminContext();
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      const { data, error } = await serviceSupabase
        .from('custom_setup_templates')
        .select('id, slug, name, category, is_active, base_price, currency')
        .order('name', { ascending: true });

      if (error) {
        logger.error('admin_custom_setups.list_templates_failed', {
          error: error.message,
          code: error.code,
        });
        throw error;
      }

      return NextResponse.json({ success: true, data });
    }

    const template = await fetchTemplateWithDetails(serviceSupabase, slug);

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const summary = buildCustomSetupBlueprintSummary(template) ?? null;

    return NextResponse.json({ success: true, data: { template, summary } });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logger.error('admin_custom_setups.get_unhandled', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ error: 'Failed to load custom setup data' }, { status: 500 });
  }
}

interface OptionUpdatePayload {
  target: 'option';
  id: string;
  unitPrice?: number | null;
  label?: string;
  metadata?: Record<string, unknown> | null;
}

interface ComponentUpdatePayload {
  target: 'component';
  id: string;
  unitPrice?: number | null;
  basePrice?: number | null;
  pricingFormula?: string | null;
  defaultQuantity?: number | null;
}

interface SystemUpdatePayload {
  target: 'system';
  id: string;
  baseFee?: number | null;
  pricingFormula?: string | null;
}

type UpdatePayload = OptionUpdatePayload | ComponentUpdatePayload | SystemUpdatePayload;

function isOptionUpdatePayload(payload: UpdatePayload): payload is OptionUpdatePayload {
  return payload.target === 'option';
}

function isComponentUpdatePayload(payload: UpdatePayload): payload is ComponentUpdatePayload {
  return payload.target === 'component';
}

function isSystemUpdatePayload(payload: UpdatePayload): payload is SystemUpdatePayload {
  return payload.target === 'system';
}

function sanitizeNumber(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function PATCH(request: NextRequest) {
  try {
    const { serviceSupabase } = await requireAdminContext();
    const body = await request.json();
    const updates = Array.isArray(body?.updates) ? (body.updates as UpdatePayload[]) : [];

    if (!updates.length) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    const applied: Array<{ target: string; id: string }> = [];

    for (const update of updates) {
      if (isOptionUpdatePayload(update)) {
        if (!update.id) {
          return NextResponse.json({ error: 'Missing option id' }, { status: 400 });
        }

        const unitPrice = sanitizeNumber(update.unitPrice ?? null);

        const { error } = await serviceSupabase
          .from('custom_setup_component_options')
          .update({
            ...(update.label !== undefined ? { label: update.label } : {}),
            ...(update.metadata !== undefined ? { metadata: update.metadata } : {}),
            ...(unitPrice !== undefined ? { unit_price: unitPrice } : {}),
          })
          .eq('id', update.id);

        if (error) {
          logger.error('admin_custom_setups.update_option_failed', {
            id: update.id,
            error: error.message,
            code: error.code,
          });
          throw error;
        }

        applied.push({ target: 'option', id: update.id });
        continue;
      }

      if (isComponentUpdatePayload(update)) {
        if (!update.id) {
          return NextResponse.json({ error: 'Missing component id' }, { status: 400 });
        }

        const unitPrice = sanitizeNumber(update.unitPrice);
        const basePrice = sanitizeNumber(update.basePrice);
        const defaultQuantity = sanitizeNumber(update.defaultQuantity);

        const { error } = await serviceSupabase
          .from('custom_setup_components')
          .update({
            ...(unitPrice !== undefined ? { unit_price: unitPrice } : {}),
            ...(basePrice !== undefined ? { base_price: basePrice } : {}),
            ...(defaultQuantity !== undefined ? { default_quantity: defaultQuantity } : {}),
            ...(update.pricingFormula !== undefined ? { price_formula: update.pricingFormula } : {}),
          })
          .eq('id', update.id);

        if (error) {
          logger.error('admin_custom_setups.update_component_failed', {
            id: update.id,
            error: error.message,
            code: error.code,
          });
          throw error;
        }

        applied.push({ target: 'component', id: update.id });
        continue;
      }

      if (isSystemUpdatePayload(update)) {
        if (!update.id) {
          return NextResponse.json({ error: 'Missing system id' }, { status: 400 });
        }

        const baseFee = sanitizeNumber(update.baseFee);

        const { error } = await serviceSupabase
          .from('custom_setup_systems')
          .update({
            ...(baseFee !== undefined ? { base_fee: baseFee } : {}),
            ...(update.pricingFormula !== undefined ? { pricing_formula: update.pricingFormula } : {}),
          })
          .eq('id', update.id);

        if (error) {
          logger.error('admin_custom_setups.update_system_failed', {
            id: update.id,
            error: error.message,
            code: error.code,
          });
          throw error;
        }

        applied.push({ target: 'system', id: update.id });
        continue;
      }

      return NextResponse.json({ error: 'Unsupported update target' }, { status: 400 });
    }

    // Invalidate Redis cache for blueprint templates
    const redis = getRedis();
    if (redis) {
      try {
        await redis.del(`blueprint:summary:${DEFAULT_CUSTOM_SETUP_TEMPLATE_SLUG}`);
        const keys = await redis.keys('blueprint:summary:*');
        if (keys.length > 0) {
          await redis.del(...keys);
        }
        logger.info('admin_custom_setups.cache_invalidated', { keysCleared: keys.length });
      } catch (err) {
        logger.warn('admin_custom_setups.cache_invalidation_failed', {
          error: err instanceof Error ? err.message : err,
        });
      }
    }

    return NextResponse.json({ success: true, applied });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logger.error('admin_custom_setups.patch_unhandled', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ error: 'Failed to update custom setup pricing' }, { status: 500 });
  }
}
