import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';

export async function GET(_: NextRequest) {
  try {
    // Create template CSV with sample data and instructions
    const headers = [
      'name',
      'brand',
      'description',
      'mrp',
      'price',
      'category',
      'image',
      'warranty',
      'hsnCode',
      'gstRate',
      'isSerialNumberCompulsory',
      'popularity',
      'rating',
      'reviewCount'
    ];

    const sampleData = [
      'Sample Product Name',
      'Sample Brand',
      'Detailed product description here',
      '1999.00',
      '1799.00',
      'Electronics',
      'https://example.com/image.jpg',
      '1 Year',
      '85171200',
      '18',
      'false',
      '0',
      '4.5',
      '0'
    ];

    const instructions = [
      '# PRODUCT IMPORT TEMPLATE',
      '# Instructions:',
      '# 1. Fill in product data starting from row 5',
      '# 2. Do not modify the header row (row 4)',
      '# 3. Required fields: name, price, category',
      '# 4. Boolean fields: use "true" or "false" for isSerialNumberCompulsory',
      '# 5. Numeric fields: use decimal format (e.g., 1999.00)',
      '# 6. Image URLs should be valid HTTP/HTTPS links',
      '# 7. GST Rate should be numeric (e.g., 18 for 18%)',
      '# 8. Leave fields empty if not applicable',
      '',
      '',
      '',
      headers.join(','),
      sampleData.join(',')
    ];

    const csvContent = instructions.join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="product-import-template.csv"',
      },
    });
  } catch (error) {
    logger.error('Template generation error:', { error });
    return NextResponse.json(
      { message: 'Failed to generate template' },
      { status: 500 }
    );
  }
}
