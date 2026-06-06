export const uiText = {
  adminProducts: {
    loadingInline: 'Loading products…',
    loadingPage: 'Loading products dashboard…',
    errorTitle: 'Unable to load products',
    errorBody: 'Something went wrong.',
    retry: 'Retry',
    reload: 'Reload page',
  },
  productDetail: {
    loadingTitle: 'Loading product…',
    errorTitle: 'Unable to load product',
    errorBody: 'Something went wrong while loading this product.',
    retry: 'Retry',
    reload: 'Reload page',
  },
};

const htmlEntityMap: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (entity, code: string) => {
    const key = code.toLowerCase();

    if (key.startsWith('#x')) {
      const codePoint = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }

    if (key.startsWith('#')) {
      const codePoint = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }

    return htmlEntityMap[key] ?? entity;
  });
}

export function stripHtmlToPlainText(raw: string | null | undefined, maxLength?: number): string {
  const clean = decodeHtmlEntities(raw ?? '')
    .replace(/<!doctype[\s\S]*?>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return typeof maxLength === 'number' ? clean.slice(0, maxLength) : clean;
}
