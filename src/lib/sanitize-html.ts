import DOMPurify from 'isomorphic-dompurify';

// Add a hook to enforce safe linking behavior globally for DOMPurify
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName.toLowerCase() === 'a') {
    const target = node.getAttribute('target');
    if (target && target.toLowerCase() === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
});

export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string' || !input.trim()) return '';

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      'a', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'p', 'br',
      'span', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'blockquote'
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class']
  });
}

export default sanitizeHtml;
