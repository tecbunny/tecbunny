export interface AiProductDetails {
  title?: string;
  vendor?: string;
  brand?: string;
  category?: string;
  productType?: string;
  tags?: string[];
  description?: string;
  price?: number | null;
  mrp?: number | null;
  hsnCode?: string;
  gstRate?: string;
  warranty?: string;
  modelNumber?: string;
  barcode?: string;
  specifications?: Record<string, string>;
  installationApplicable?: boolean;
  installationCharge?: number | null;
  handleSuggestion?: string;
  imageUrl?: string;
  productUrl?: string;
}

export interface AiProductDetailsRequest {
  productUrl: string;
  existingData?: Partial<AiProductDetails>;
}

export async function fetchAiProductDetails(input: AiProductDetailsRequest): Promise<AiProductDetails> {
  const response = await fetch('/api/ai/product-details', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.error) {
    throw new Error(result?.error || 'Failed to fetch product details');
  }

  return (result?.details ?? result) as AiProductDetails;
}

export function formatAiSpecifications(specifications?: Record<string, string> | null): string {
  if (!specifications) {
    return '';
  }

  return Object.entries(specifications)
    .map(([key, value]) => `${key}:${value}`)
    .join(', ');
}