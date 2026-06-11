import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { InvoiceTemplate, type CompanySettings } from '@/components/invoices/InvoiceTemplate';
import type { Order } from '@/lib/types';
import { createServiceClient } from '@/lib/supabase/server';
import { deserializeOrder } from '@/lib/orders/normalizers';
import { logger } from '@/lib/logger';

// export const dynamic = 'force-dynamic';

interface InvoicePageProps {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const COMPANY_INFO_PATH = path.join(process.cwd(), 'public', 'company-info.json');

const FALLBACK_COMPANY_SETTINGS: CompanySettings = {
  name: 'TecBunny Solutions',
  address: 'H NO 11 NHAYGINWADA, PARSE, Parxem, Pernem, North Goa- 403512, Goa',
  gstin: '30AAMCT1608G1ZO',
  pan: 'AAMCT1608G',
  tan: 'BLRT25863F',
  cin: 'U80200GA2025PTC017488',
  supportEmail: 'support@tecbunny.com',
  supportPhone: '+91 96041 36010',
};

async function loadOrder(orderId: string): Promise<Order | null> {
  const supabase = createServiceClient();
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !data) {
      if (error) {
        logger.warn('Invoice page failed to load order', { orderId, error: error.message });
      }
      return null;
    }

    const order = deserializeOrder(data);

    const itemsNeedingLookup = order.items.filter(item => {
      const missingHsn = !item.hsnCode || item.hsnCode === '9999';
      const missingGst = typeof item.gstRate !== 'number' || !Number.isFinite(item.gstRate);
      return missingHsn || missingGst;
    });

    if (itemsNeedingLookup.length === 0) {
      return order;
    }

    const ids = Array.from(
      new Set(
        itemsNeedingLookup
          .map(item => item.productId || (item as any).product_id || null)
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      )
    );

    if (ids.length === 0) {
      return order;
    }

    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, hsn_code, hsn, hsn_sac, gst_rate, gst_percentage')
      .in('id', ids);

    if (productError || !products) {
      if (productError) {
        logger.warn('Invoice page failed to hydrate HSN/GST for items', {
          orderId,
          error: productError.message,
          ids,
        });
      }
      return order;
    }

    const productLookup = new Map<string, any>();
    products.forEach(record => {
      if (record?.id) {
        productLookup.set(record.id, record);
      }
    });

    const enrichedItems = order.items.map(item => {
      const key = item.productId || (item as any).product_id;
      const productRecord = key ? productLookup.get(key) : undefined;
      if (!productRecord) {
        return item;
      }

      const resolvedHsn =
        productRecord.hsnCode ??
        productRecord.hsn_code ??
        productRecord.hsn ??
        productRecord.hsn_sac ??
        null;
      const resolvedGst =
        productRecord.gstRate ??
        productRecord.gst_rate ??
        productRecord.gst_percentage ??
        null;

      const normalizedHsn = resolvedHsn != null ? String(resolvedHsn).trim() : undefined;
      let normalizedGst: number | undefined;
      if (typeof resolvedGst === 'number' && Number.isFinite(resolvedGst)) {
        normalizedGst = resolvedGst;
      } else if (typeof resolvedGst === 'string') {
        const parsed = Number.parseFloat(resolvedGst);
        normalizedGst = Number.isFinite(parsed) ? parsed : undefined;
      }

      return {
        ...item,
        hsnCode: (!item.hsnCode || item.hsnCode === '9999') && normalizedHsn ? normalizedHsn : item.hsnCode,
        gstRate: typeof item.gstRate === 'number' && Number.isFinite(item.gstRate)
          ? item.gstRate
          : normalizedGst ?? item.gstRate,
      };
    });

    return {
      ...order,
      items: enrichedItems,
    };
  } catch (error) {
    logger.error('Invoice page encountered an unexpected error while fetching order', {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function loadCompanySettings(): Promise<CompanySettings> {
  try {
    const raw = await fs.readFile(COMPANY_INFO_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return {
      ...FALLBACK_COMPANY_SETTINGS,
      name: typeof parsed.companyName === 'string' ? parsed.companyName : FALLBACK_COMPANY_SETTINGS.name,
      address: typeof parsed.registeredAddress === 'string' ? parsed.registeredAddress : FALLBACK_COMPANY_SETTINGS.address,
      gstin: typeof parsed.gstin === 'string' ? parsed.gstin : FALLBACK_COMPANY_SETTINGS.gstin,
      pan: typeof parsed.pan === 'string' ? parsed.pan : FALLBACK_COMPANY_SETTINGS.pan,
      tan: typeof parsed.tan === 'string' ? parsed.tan : FALLBACK_COMPANY_SETTINGS.tan,
      cin: typeof parsed.cin === 'string' ? parsed.cin : FALLBACK_COMPANY_SETTINGS.cin,
      supportEmail: typeof parsed.supportEmail === 'string' ? parsed.supportEmail : FALLBACK_COMPANY_SETTINGS.supportEmail,
      supportPhone: typeof parsed.supportPhone === 'string' ? parsed.supportPhone : FALLBACK_COMPANY_SETTINGS.supportPhone,
    };
  } catch (error) {
    logger.warn('Invoice page falling back to default company settings', {
      error: error instanceof Error ? error.message : String(error),
    });
    return FALLBACK_COMPANY_SETTINGS;
  }
}

export async function generateMetadata({ params }: InvoicePageProps): Promise<Metadata> {
  // Import the utility function dynamically since this is a server component
  const { formatOrderNumber } = await import('@/lib/order-utils');
  const { orderId } = await params;
  const shortId = orderId ? formatOrderNumber(orderId) : 'Invoice';
  return {
    title: `Invoice ${shortId} | TecBunny Solutions`,
    description: `Download a professionally formatted invoice for order ${shortId}.`,
  };
}

export default async function OrderInvoicePage({ params, searchParams }: InvoicePageProps) {
  const { orderId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const order = await loadOrder(orderId);

  if (!order) {
    notFound();
  }

  const settings = await loadCompanySettings();
  const printParam = resolvedSearchParams?.print;
  const shouldAutoPrint = Array.isArray(printParam)
    ? printParam.some(value => value === '1' || value === 'true')
    : printParam === '1' || printParam === 'true';

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 print:bg-white print:py-0">
      <div className="max-w-5xl mx-auto">
        <InvoiceTemplate order={order} settings={settings} autoPrint={shouldAutoPrint} />
      </div>
    </div>
  );
}
