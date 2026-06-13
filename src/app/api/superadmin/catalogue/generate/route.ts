import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { verifySuperadminSessionToken } from '@/lib/auth/superadmin-session';
import { generateCataloguePdf } from '@/lib/catalogue-pdf-generator';
import { loadCompanyInfo } from '@/lib/pdf-generator';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // 1. Role Restriction & Access Control
    const cookieStore = await cookies();
    const superadminCookie = cookieStore.get('superadmin-session')?.value;
    const isSuperadmin = Boolean(await verifySuperadminSessionToken(superadminCookie));

    if (!isSuperadmin) {
      logger.warn('Catalogue PDF request rejected: unauthorized access attempt.');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 2. Parse payload configurations
    const body = await request.json().catch(() => ({}));
    const { 
      categories = [], 
      productIds = [], 
      serviceIds = [], 
      includePricing = false 
    } = body;

    // 3. Query Database via Supabase client
    const supabase = createServiceClient();

    const [productsResult, servicesResult, companyInfo] = await Promise.all([
      supabase.from('products').select('*').eq('status', 'active'),
      supabase.from('services').select('*').eq('is_active', true),
      loadCompanyInfo(),
    ]);

    if (productsResult.error) {
      logger.error('Catalogue generation: failed to fetch products', { error: productsResult.error });
      return new NextResponse('Database Error (Products)', { status: 500 });
    }

    if (servicesResult.error) {
      logger.error('Catalogue generation: failed to fetch services', { error: servicesResult.error });
      return new NextResponse('Database Error (Services)', { status: 500 });
    }

    // 4. Apply filter criteria
    let products = productsResult.data || [];
    let services = servicesResult.data || [];

    // Filter categories if specified
    if (categories.length > 0) {
      products = products.filter((p) => categories.includes(p.category));
      services = services.filter((s) => categories.includes(s.category));
    }

    // Filter specific checked product/service IDs
    if (Array.isArray(productIds)) {
      products = products.filter((p) => productIds.includes(p.id));
    }
    if (Array.isArray(serviceIds)) {
      services = services.filter((s) => serviceIds.includes(s.id));
    }

    // 5. Generate catalogue stream
    const pdfBuffer = await generateCataloguePdf({
      products,
      services,
      includePricing: Boolean(includePricing),
      companyInfo,
    });

    // 6. Return streamed binary PDF attachment
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="catalogue.pdf"',
        'Content-Length': String(pdfBuffer.byteLength),
      },
    });

  } catch (error) {
    logger.error('Catalogue API generation error:', { error });
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
