DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'whatsapp_messages'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id
      ON public.whatsapp_messages (whatsapp_message_id)
      WHERE whatsapp_message_id IS NOT NULL;
  END IF;
END $$;
