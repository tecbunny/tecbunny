import DOMPurify from 'dompurify';

export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string' || !input.trim()) return '';

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      'a', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'p', 'br',
      'span', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'blockquote'
    ],
    ALLOWED_ATTR: ['class', 'title', 'href', 'target', 'rel'],
    ADD_ATTR: ['target'],
  });
}

export default sanitizeHtml;
