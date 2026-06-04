-- Find product descriptions where pasted HTML, style blocks, or scripts are leaking into SEO text.
select
  id,
  coalesce(title, name, id::text) as product_name,
  left(description, 240) as current_description
from products
where description ~* '<(style|script|html|head|body|div|p|h[1-6]|ul|ol|li|table|span|br)\b'
   or description ~* 'body\s*\{[^}]*font-family'
order by updated_at desc nulls last, created_at desc nulls last;

-- Clean affected rows by removing complete style/script blocks first, then remaining tags.
-- Run the SELECT above first. Run this UPDATE only after confirming the affected rows.
update products
set
  description = nullif(
    trim(
      regexp_replace(
        replace(
          replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(description, '<style[^>]*>[\s\S]*?</style>', ' ', 'gi'),
                '<script[^>]*>[\s\S]*?</script>',
                ' ',
                'gi'
              ),
              '<[^>]+>',
              ' ',
              'g'
            ),
            '&nbsp;',
            ' '
          ),
          '&amp;',
          '&'
        ),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  ),
  updated_at = now()
where description ~* '<(style|script|html|head|body|div|p|h[1-6]|ul|ol|li|table|span|br)\b'
   or description ~* 'body\s*\{[^}]*font-family';
