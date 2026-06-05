import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export interface PageContent {
  id: string;
  page_key: string;
  title: string;
  content: any;
  meta_description?: string;
  meta_keywords?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const PAGE_CONTENT_SELECTS = [
  'id,page_key,title,content,status,meta_description,meta_keywords,created_at,updated_at',
  'id,key,title,content,status,meta_description,meta_keywords,created_at,updated_at',
  'id,key,title,content,is_active,meta_description,meta_keywords,created_at,updated_at',
  'id,page_key,title,content,created_at,updated_at',
  'id,key,title,content,created_at,updated_at',
];

export async function getPageContentServer(pageKey: string): Promise<PageContent | null> {
  try {
    const supabase = await createClient();
    
    // Try modern and legacy schemas dynamically
    const attempts = [
      () => supabase.from('page_content').select(PAGE_CONTENT_SELECTS[0]).eq('page_key', pageKey).eq('status', 'published').maybeSingle(),
      () => supabase.from('page_content').select(PAGE_CONTENT_SELECTS[1]).eq('key', pageKey).eq('status', 'published').maybeSingle(),
      () => supabase.from('page_content').select(PAGE_CONTENT_SELECTS[2]).eq('key', pageKey).eq('is_active', true).maybeSingle(),
      () => supabase.from('page_content').select(PAGE_CONTENT_SELECTS[3]).eq('page_key', pageKey).maybeSingle(),
      () => supabase.from('page_content').select(PAGE_CONTENT_SELECTS[4]).eq('key', pageKey).maybeSingle(),
    ];

    for (const run of attempts) {
      const { data: rawData, error } = await run();
      const data = rawData as any;
      if (!error && data) {
        // Normalize fields
        const page_key = data.page_key ?? data.key ?? null;
        const status = data.status ?? (data.is_active === true ? 'published' : data.is_active === false ? 'draft' : undefined);
        let content = data.content ?? data.data ?? null;
        if (typeof content === 'string') {
          try {
            content = JSON.parse(content);
          } catch {
            // keep as string
          }
        }
        return {
          ...data,
          page_key,
          status,
          content,
        } as PageContent;
      }
    }
    return null;
  } catch (error) {
    logger.error('Error fetching page content on server:', { error, pageKey });
    return null;
  }
}
