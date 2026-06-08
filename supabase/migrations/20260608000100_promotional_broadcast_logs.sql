-- Create the marketing_broadcast_logs table
CREATE TABLE IF NOT EXISTS public.marketing_broadcast_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_name TEXT NOT NULL,
    channel_type TEXT NOT NULL CHECK (channel_type IN ('WhatsApp', 'Email')),
    recipient_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    execution_status TEXT NOT NULL CHECK (execution_status IN ('Pending', 'In Progress', 'Completed', 'Failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.marketing_broadcast_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admins
CREATE POLICY "Admins can view broadcast logs"
    ON public.marketing_broadcast_logs
    FOR SELECT
    USING (public.is_admin_user());

CREATE POLICY "Admins can insert broadcast logs"
    ON public.marketing_broadcast_logs
    FOR INSERT
    WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins can update broadcast logs"
    ON public.marketing_broadcast_logs
    FOR UPDATE
    USING (public.is_admin_user());
