import sanitizeHtmlLib from 'sanitize-html';

export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string' || !input.trim()) return '';

  return sanitizeHtmlLib(input, {
    allowedTags: [
      'a', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'p', 'br',
      'span', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'blockquote'
    ],
    allowedAttributes: {
      '*': ['class', 'title'],
      'a': ['href', 'target', 'rel']
    },
    transformTags: {
      'a': (tagName, attribs) => {
        // Enforce safe linking behavior globally
        if (attribs.target && attribs.target.toLowerCase() === '_blank') {
          attribs.rel = 'noopener noreferrer';
        }
        return {
          tagName,
          attribs
        };
      }
    }
  });
}

export default sanitizeHtml;
