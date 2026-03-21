import { NextRequest } from 'next/server';

import { APIResponseBuilder } from '@/lib/api-response';
import { buildCustomSetupBlueprintSummary, fetchCustomSetupTemplateBySlug } from '@/lib/custom-setup-service';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const includeRaw = searchParams.get('includeRaw');

  if (!slug) {
    return APIResponseBuilder.badRequest('Missing required "slug" query parameter');
  }

  try {
    const template = await fetchCustomSetupTemplateBySlug(slug);

    if (!template) {
      return APIResponseBuilder.notFound('Custom setup template not found');
    }

    const summary = buildCustomSetupBlueprintSummary(template);

    if (!summary) {
      return APIResponseBuilder.internalServerError('Unable to build template summary');
    }

    if (includeRaw === 'true') {
      return APIResponseBuilder.success({ template, summary });
    }

    return APIResponseBuilder.success({ summary });
  } catch (error) {
    logger.error('api.custom_setups.fetch_failed', {
      slug,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error
    });
    return APIResponseBuilder.internalServerError('Failed to fetch custom setup template');
  }
}
