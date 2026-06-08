import { useState, useEffect } from 'react';

import { logger } from '@/lib/logger';

interface PageContent {
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

export function usePageContent(pageKey: string) {
  const [content, setContent] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/page-content?key=${pageKey}`, {
          cache: 'no-store',
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch page content');
        }

        // data can be null when no content exists for the key
        setContent(result.data ?? null);
        setRetryCount(0); // Reset on success
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        logger.error('Error fetching page content:', { error: err });
        
        // Auto-retry with backoff and limit (max 3 retries)
        if (err instanceof Error && err.message.includes('fetch') && retryCount < 3) {
          const timeout = 2000 * Math.pow(2, retryCount);
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, timeout);
        }
      } finally {
        setLoading(false);
      }
    };

    if (pageKey) {
      fetchContent();
    }
  }, [pageKey, retryCount]);

  const updateContent = async (updates: {
    title?: string;
    content?: any;
    metaDescription?: string;
    metaKeywords?: string;
  }) => {
    try {
      const response = await fetch('/api/page-content', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageKey,
          title: updates.title || content?.title,
          content: updates.content || content?.content,
          metaDescription: updates.metaDescription || content?.meta_description,
          metaKeywords: updates.metaKeywords || content?.meta_keywords,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update page content');
      }

      // Update local state
      setContent(result.data);
      
      return { success: true, data: result.data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  return {
    content,
    loading,
    error,
    updateContent,
    refetch: () => {
      if (pageKey) {
        setLoading(true);
        setError(null);
        // Re-trigger useEffect
        setContent(null);
      }
    }
  };
}

export function useAllPageContents() {
  const [pages, setPages] = useState<PageContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllPages = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/page-content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'list_all' }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch page contents');
        }

        setPages(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        logger.error('Error fetching all page contents:', { error: err });
      } finally {
        setLoading(false);
      }
    };

    fetchAllPages();
  }, []);

  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/page-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'list_all' }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch page contents');
      }

      setPages(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      logger.error('Error fetching all page contents:', { error: err });
    } finally {
      setLoading(false);
    }
  };

  return {
    contents: pages,
    loading,
    error,
    refetch
  };
}
