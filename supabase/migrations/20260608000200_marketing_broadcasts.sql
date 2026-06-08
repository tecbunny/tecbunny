-- Migration: 20260608000200_marketing_broadcasts.sql

CREATE TABLE IF NOT EXISTS public.marketing_broadcast_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_name TEXT NOT NULL,
    channel_type TEXT NOT NULL CHECK (channel_type IN ('whatsapp', 'email')),
    recipient_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    execution_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (execution_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    failure_summary JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.marketing_broadcast_logs ENABLE ROW LEVEL SECURITY;

-- Block public lookups, restrict strictly to Admins and Superadmins
CREATE POLICY "Admins can insert broadcast logs" 
ON public.marketing_broadcast_logs 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Admins can view broadcast logs" 
ON public.marketing_broadcast_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'superadmin')
  )
);

-- Service Role Bypass (For asynchronous background processors like /api/admin/marketing/broadcast/route.ts)
CREATE POLICY "Service role full access on marketing_broadcast_logs"
ON public.marketing_broadcast_logs
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
