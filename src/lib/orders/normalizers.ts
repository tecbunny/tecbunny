import type { Order, OrderItem, OrderStatus, OrderType } from '../types';
import { logger } from '../logger';

export const STATUS_MAP: Record<string, OrderStatus> = {
  pending: 'Pending',
  'awaiting payment': 'Awaiting Payment',
  'payment confirmed': 'Payment Confirmed',
  confirmed: 'Confirmed',
  processing: 'Processing',
  'ready to ship': 'Ready to Ship',
  shipped: 'Shipped',
  'ready for pickup': 'Ready for Pickup',
  completed: 'Completed',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

const TYPE_MAP: Record<string, OrderType> = {
  delivery: 'Delivery',
  pickup: 'Pickup',
  'pick-up': 'Pickup',
  'walk-in': 'Walk-in',
  walkin: 'Walk-in',
  'walk in': 'Walk-in',
  'walk_in': 'Walk-in',
};

type RawItemsPayload = {
  cart_items?: unknown;
  customer_email?: string;
  customer_phone?: string;
  delivery_address?: string;
  pickup_store?: string;
  customer_state?: string;
  customer_state_code?: string;
  place_of_supply?: string;
  place_of_supply_state_code?: string;
  seller_state_code?: string;
  payment_method?: string;
  customer_notes?: string;
  discount_amount?: unknown;
  shipping_amount?: unknown;
};

function numberFrom(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function parseOrderItemsBlob(rawItems: unknown): RawItemsPayload | null {
  if (!rawItems) {
    return null;
  }

  try {
    if (typeof rawItems === 'string') {
      return JSON.parse(rawItems) as RawItemsPayload;
    }

    if (typeof rawItems === 'object') {
      return rawItems as RawItemsPayload;
    }
  } catch (error) {
    logger.warn('Order normalizer failed to parse order items blob', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return null;
}

export function normalizeOrderStatus(status: string | OrderStatus | null | undefined): OrderStatus {
  if (!status) {
    return 'Pending';
  }

  const normalized = STATUS_MAP[status.toLowerCase()];
  return normalized ?? (status as OrderStatus);
}

function normalizeOrderType(type: unknown): OrderType {
  if (typeof type === 'string' && type.trim()) {
    const key = type.trim().toLowerCase();
    const mapped = TYPE_MAP[key];
    if (mapped) {
      return mapped;
    }
    // Preserve existing canonical values even if case differs
    if (key === 'delivery') return 'Delivery';
    if (key === 'pickup') return 'Pickup';
    if (key === 'walk-in' || key === 'walkin' || key === 'walk in' || key === 'walk_in') return 'Walk-in';
  }
  return 'Delivery';
}

export function deserializeOrder(rawOrder: any): Order {
  const itemsPayload = (parseOrderItemsBlob(rawOrder?.items) ?? {}) as RawItemsPayload;

  const parsedItems: OrderItem[] = Array.isArray(rawOrder?.items)
    ? (rawOrder.items as OrderItem[])
    : Array.isArray(itemsPayload.cart_items)
      ? (itemsPayload.cart_items as OrderItem[])
      : [];

  const normalizedItems: OrderItem[] = parsedItems.map((item) => {
    const source = item as unknown as Record<string, unknown>;
    const rawHsn =
      source['hsnCode'] ??
      source['hsn_code'] ??
      source['hsn'] ??
      source['hsn_sac'] ??
      item.hsnCode ??
      null;
    const rawGst =
      source['gstRate'] ??
      source['gst_rate'] ??
      source['gst_percentage'] ??
      source['gst'] ??
      item.gstRate ??
      undefined;

    const normalizedHsn = rawHsn != null ? String(rawHsn).trim() : undefined;

    let normalizedGstRate: number | undefined;
    if (typeof rawGst === 'number') {
      normalizedGstRate = Number.isFinite(rawGst) ? rawGst : undefined;
    } else if (typeof rawGst === 'string') {
      const parsed = Number.parseFloat(rawGst);
      normalizedGstRate = Number.isFinite(parsed) ? parsed : undefined;
    } else {
      normalizedGstRate = undefined;
    }

    return {
      ...item,
      hsnCode: normalizedHsn || item.hsnCode,
      gstRate: normalizedGstRate ?? item.gstRate,
    };
  });

  const normalizedStatus = normalizeOrderStatus(rawOrder?.status);
  const normalizedType = normalizeOrderType(rawOrder?.type ?? rawOrder?.order_type);

  const subtotal = numberFrom(rawOrder?.subtotal ?? rawOrder?.pre_tax_total ?? rawOrder?.total_amount ?? 0);
  const gstAmount = numberFrom(rawOrder?.gst_amount ?? rawOrder?.tax_amount ?? 0);
  const discountAmount = numberFrom(rawOrder?.discount_amount ?? itemsPayload.discount_amount ?? 0);
  const shippingAmount = numberFrom(rawOrder?.shipping_amount ?? itemsPayload.shipping_amount ?? 0);
  const total = numberFrom(
    rawOrder?.total ?? rawOrder?.total_amount ?? subtotal + gstAmount - discountAmount + shippingAmount,
  );

  return {
    ...rawOrder,
    status: normalizedStatus,
    type: normalizedType,
    subtotal,
    gst_amount: gstAmount,
    discount_amount: discountAmount,
    shipping_amount: shippingAmount,
    total,
  items: normalizedItems,
    customer_email: itemsPayload.customer_email ?? rawOrder?.customer_email ?? undefined,
    customer_phone: itemsPayload.customer_phone ?? rawOrder?.customer_phone ?? undefined,
    delivery_address: itemsPayload.delivery_address ?? rawOrder?.delivery_address ?? undefined,
    pickup_store: itemsPayload.pickup_store ?? rawOrder?.pickup_store ?? undefined,
    customer_state: itemsPayload.customer_state ?? rawOrder?.customer_state ?? undefined,
    customer_state_code: itemsPayload.customer_state_code ?? rawOrder?.customer_state_code ?? undefined,
    place_of_supply: itemsPayload.place_of_supply ?? rawOrder?.place_of_supply ?? undefined,
    place_of_supply_state_code: itemsPayload.place_of_supply_state_code ?? rawOrder?.place_of_supply_state_code ?? undefined,
    seller_state_code: itemsPayload.seller_state_code ?? rawOrder?.seller_state_code ?? undefined,
    payment_method: itemsPayload.payment_method ?? rawOrder?.payment_method ?? undefined,
    notes: itemsPayload.customer_notes ?? rawOrder?.notes ?? undefined,
    part_payment_amount: (itemsPayload as any).part_payment_amount ?? null,
    quote_id: (itemsPayload as any).quote_id ?? null,
    pending_amount_requested: (itemsPayload as any).pending_amount_requested ?? false,
    pending_payment_status: (itemsPayload as any).pending_payment_status ?? 'unpaid',
    pending_payment_method: (itemsPayload as any).pending_payment_method ?? null,
    invoice_pdf_url: (itemsPayload as any).invoice_pdf_url ?? null,
  } as Order;
}
