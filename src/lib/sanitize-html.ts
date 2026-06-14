import DOMPurify from 'dompurify';

const ALLOWED_TAGS = new Set([
  'a', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'p', 'br',
  'span', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'blockquote'
]);

const ALLOWED_ATTR = new Set(['class', 'title', 'href', 'target', 'rel']);

function serverSanitize(html: string): string {
  // 1. Remove comments
  let clean = html.replace(/<!--[\s\S]*?-->/g, '');

  // 2. Remove script & style blocks completely
  clean = clean.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  clean = clean.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

  // 3. Match HTML tags
  const tagRegex = /<\/?([a-z0-9:-]+)(?:\s+[^>]*)?>/gi;
  
  return clean.replace(tagRegex, (match, tagName) => {
    const isClosing = match.startsWith('</');
    const lowerTagName = tagName.toLowerCase();

    // Check if tag is allowed
    if (!ALLOWED_TAGS.has(lowerTagName)) {
      return ''; // Strip disallowed tag
    }

    if (isClosing) {
      return `</${lowerTagName}>`;
    }

    // Parse attributes for opening tag
    const attrRegex = /([a-z0-9:-]+)\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s>]+))/gi;
    let attrMatch;
    const resolvedAttrs: string[] = [];

    while ((attrMatch = attrRegex.exec(match)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      let attrValue = attrMatch[2] || attrMatch[3] || attrMatch[4] || '';

      // Strip any attribute starting with 'on' (event handlers)
      if (attrName.startsWith('on')) {
        continue;
      }

      // Check if attribute is allowed
      if (!ALLOWED_ATTR.has(attrName)) {
        continue;
      }

      // Sanitize URL attributes (like href) to prevent javascript: or data: protocols
      if (attrName === 'href') {
        const decodedValue = decodeURIComponent(attrValue).replace(/\s+/g, '').toLowerCase();
        if (
          decodedValue.startsWith('javascript:') ||
          decodedValue.startsWith('data:') ||
          decodedValue.startsWith('vbscript:')
        ) {
          attrValue = '#';
        }
      }

      resolvedAttrs.push(`${attrName}="${attrValue.replace(/"/g, '&quot;')}"`);
    }

    // Special logic for target="_blank" adding rel="noopener noreferrer"
    if (resolvedAttrs.some(a => a.startsWith('target="_blank"'))) {
      if (!resolvedAttrs.some(a => a.startsWith('rel='))) {
        resolvedAttrs.push('rel="noopener noreferrer"');
      }
    }

    const attrString = resolvedAttrs.length > 0 ? ' ' + resolvedAttrs.join(' ') : '';
    return `<${lowerTagName}${attrString}>`;
  });
}

export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string' || !input.trim()) return '';

  if (typeof window === 'undefined') {
    return serverSanitize(input);
  }

  const purify = typeof DOMPurify.sanitize === 'function' 
    ? DOMPurify 
    : (DOMPurify as any).default || DOMPurify;

  if (typeof purify.sanitize !== 'function') {
    return serverSanitize(input);
  }

  return purify.sanitize(input, {
    ALLOWED_TAGS: Array.from(ALLOWED_TAGS),
    ALLOWED_ATTR: Array.from(ALLOWED_ATTR),
    ADD_ATTR: ['target'],
  });
}

export default sanitizeHtml;
