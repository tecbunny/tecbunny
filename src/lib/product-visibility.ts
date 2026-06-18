import { stripHtmlToPlainText } from '@/lib/strings';
import { getProductDisplayImage } from '@/lib/image-utils';

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function firstPositive(product: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = toPositiveNumber(product[key]);
    if (value !== null) return value;
  }
  return null;
}

function hasPublicDescription(product: Record<string, unknown>) {
  const raw = product.description ?? product.body_html ?? product.details;
  if (typeof raw !== 'string') return false;
  return stripHtmlToPlainText(raw, 200).trim().length > 0;
}

export function isPubliclyVisibleProduct(product: Record<string, unknown> | null | undefined) {
  if (!product) return false;

  const status = typeof product.status === 'string' ? product.status.trim().toLowerCase() : '';
  const isActive = !status || status === 'active' || status === 'published';
  const isNotDeleted = product.is_deleted !== true && product.deleted_at == null;
  const hasSalePrice = firstPositive(product, ['price', 'selling_price', 'sale_price', 'offer_price', 'discount_price', 'unit_price']) !== null;

  return isActive && isNotDeleted && hasSalePrice;
}

export function filterPubliclyVisibleProducts<T extends Record<string, unknown>>(products: T[]) {
  return products.filter(isPubliclyVisibleProduct);
}
