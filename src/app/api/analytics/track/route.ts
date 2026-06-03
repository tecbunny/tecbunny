import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabasePublicConfigured } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-VCCMTMSVP4';
const GA_API_SECRET = process.env.GA_API_SECRET;
const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

type AnalyticsMetadata = Record<string, string | number | boolean | null>;

function isFetchFailure(err: unknown) {
  if (!err || typeof err !== 'object') return false;
  const message = String((err as { message?: string }).message || '').toLowerCase();
  return message.includes('fetch failed');
}

function parseGaClientId(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)_ga=([^;]+)/);
  if (!match) return null;
  const value = decodeURIComponent(match[1]);
  const parts = value.split('.');
  if (parts.length < 4) return null;
  return `${parts[2]}.${parts[3]}`;
}

function getClientId(request: NextRequest, sessionId?: string | null) {
  if (sessionId) return sessionId;
  const cookieClientId = parseGaClientId(request.headers.get('cookie'));
  if (cookieClientId) return cookieClientId;
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}.${Math.floor(Math.random() * 1e9)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toAnalyticsMetadata(value: unknown): AnalyticsMetadata {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.entries(value).reduce<AnalyticsMetadata>((accumulator, [key, entry]) => {
    if (
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean' ||
      entry === null
    ) {
      accumulator[key] = entry;
    }
    return accumulator;
  }, {});
}

function resolveResourceId(resourceId: unknown, metadata: AnalyticsMetadata) {
  const candidates = [
    resourceId,
    metadata.resourceId,
    metadata.productId,
    metadata.serviceId,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return null;
}

async function sendGaEvent(params: {
  clientId: string;
  userId?: string | null;
  eventType: string;
  pageUrl?: string | null;
  resourceId?: string | null;
  sessionId?: string | null;
  metadata?: AnalyticsMetadata;
}) {
  if (!GA_API_SECRET) {
    return;
  }

  const eventParams: Record<string, unknown> = {
    page_location: params.pageUrl ?? undefined,
    resource_id: params.resourceId ?? undefined,
    session_id: params.sessionId ?? undefined,
    ...params.metadata,
  };

  const payload = {
    client_id: params.clientId,
    user_id: params.userId ?? undefined,
    events: [
      {
        name: params.eventType,
        params: eventParams,
      },
    ],
  };

  const response = await fetch(
    `${GA_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    logger.warn('ga.measurement_protocol.failed', { status: response.status, body: text });
  }
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (_e) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    
    // Ensure body is an object to prevent destructuring failure
    if (!body || typeof body !== 'object') {
       return NextResponse.json({ success: true, skipped: 'Empty or invalid body' });
    }

    const {
      eventType,
      pageUrl,
      resourceId,
      metadata,
      sessionId,
      ...extraFields
    } = body as Record<string, unknown>;

    if (typeof eventType !== 'string' || !eventType.trim()) {
      return NextResponse.json({ error: 'eventType is required' }, { status: 400 });
    }

    const eventMetadata = {
      ...toAnalyticsMetadata(metadata),
      ...toAnalyticsMetadata(extraFields),
    };
    const normalizedResourceId = resolveResourceId(resourceId, eventMetadata);
    const normalizedPageUrl = typeof pageUrl === 'string' ? pageUrl : null;
    const normalizedSessionId = typeof sessionId === 'string' ? sessionId : null;

    const clientId = getClientId(request, normalizedSessionId);
    let userId: string | null = null;

    if (isSupabasePublicConfigured) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;

        if (user) {
          const { error } = await supabase
            .from('analytics_events')
            .insert({
              event_type: eventType,
              page_url: normalizedPageUrl,
              resource_id: normalizedResourceId,
              metadata: Object.keys(eventMetadata).length ? eventMetadata : null,
              session_id: normalizedSessionId,
              user_id: user.id,
            });

          // Auto-generate leads for inquiries
          if (eventType === 'amc_inquiry' || eventType === 'installation_inquiry') {
            const leadType = eventType === 'amc_inquiry' ? 'amc' : 'installation';

            // Fetch user details if possible, or just store the user_id
            // For now, we rely on the user_id foreign key to link to the user profile
            const { error: leadError } = await supabase.from('leads').insert({
              user_id: user.id,
              type: leadType,
              product_id: normalizedResourceId,
              status: 'new',
              customer_email: user.email,
            });

            if (leadError) {
              logger.warn('Failed to create lead from inquiry', { error: leadError });
            }
          }

          if (error) {
            logger.warn('Failed to track analytics event', { error });
          }
        }
      } catch (sbError) {
        // Recover from Supabase errors so we can still track to GA or complete the request
        logger.warn('Supabase analytics tracking failed', { error: sbError });
      }
    }

    await sendGaEvent({
      clientId,
      userId,
      eventType,
      pageUrl: normalizedPageUrl,
      resourceId: normalizedResourceId,
      sessionId: normalizedSessionId,
      metadata: eventMetadata,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // In analytics, we prefer to fail gracefully than to throw 500s
    // which might alarm monitoring systems unnecessarily for minor tracking issues.
    
    // Check for common fetch errors or other expectable issues
    if (isFetchFailure(error) || (error instanceof Error && (
        error.message.includes('fetch') || 
        error.message.includes('network') ||
        error.message.includes('JSON')
    ))) {
       logger.warn('Analytics API Minor Error', { error });
       return NextResponse.json({ success: true, skipped: 'Analytics unavailable' });
    }

    // For other errors, log them but return 200 with skipped reason in headers or body to avoid client alerts
    // unless we are debugging.
    logger.error('Analytics API Error', { error });
    
    if (process.env.NODE_ENV === 'production') {
        // Return 200 to client to avoid console errors, but log on server
        return NextResponse.json({ success: false, skipped: 'Internal Error' }, { status: 200 }); 
    }

    return NextResponse.json({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
