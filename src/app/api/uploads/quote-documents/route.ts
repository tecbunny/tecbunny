import { NextRequest, NextResponse } from 'next/server';
import { uploadToSupabase } from '@/lib/supabase-storage';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const quoteId = formData.get('quote_id') as string | null;
    const type = formData.get('type') as string | null;

    if (!file || !quoteId) {
      return NextResponse.json({ error: 'Missing file or quote_id' }, { status: 400 });
    }

    // Basic size validation (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 });
    }

    // Basic MIME type validation
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Please upload PDF, JPEG, or PNG.' }, { status: 400 });
    }

    // Validate quote_id exists in the database
    const supabase = createServiceClient();
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      logger.warn('quote_upload.quote_not_found', { quoteId });
      return NextResponse.json({ error: 'Invalid quote ID' }, { status: 404 });
    }

    // Upload to Supabase Storage in folder 'quote-documents'
    const result = await uploadToSupabase(file, 'quote-documents');

    logger.info('quote_document_upload.success', {
      quoteId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      publicUrl: result.secure_url
    });

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      path: result.public_id
    });
  } catch (error: any) {
    logger.error('quote_document_upload.failed', { error });
    return NextResponse.json({
      error: 'Failed to upload document',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
