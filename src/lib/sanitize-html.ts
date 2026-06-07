import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      'a', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'p', 'br',
      'span', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'blockquote'
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload']
  });
}

export default sanitizeHtml;
