CREATE OR REPLACE FUNCTION public.auto_cancel_stale_orders_v1(
  p_cutoff TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 100,
  p_reason TEXT DEFAULT 'Automatically cancelled after 24 hours without payment confirmation.'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_cancelled INTEGER := 0;
  v_restored_items INTEGER := 0;
  v_stale_statuses TEXT[] := ARRAY['Pending', 'Awaiting Payment'];
  v_stale_payment_statuses TEXT[] := ARRAY[
    'Awaiting Payment',
    'Payment Confirmation Pending',
    'Pending',
    'Payment Failed',
    'Payment Cancelled'
  ];
BEGIN
  FOR v_order IN
    SELECT id, items
    FROM public.orders
    WHERE status = ANY(v_stale_statuses)
      AND created_at <= p_cutoff
      AND (payment_status = ANY(v_stale_payment_statuses) OR payment_status IS NULL)
    ORDER BY created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 100), 1)
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.orders
    SET
      status = 'Cancelled',
      payment_status = 'Payment Cancelled',
      cancellation_reason = p_reason,
      cancelled_at = NOW(),
      updated_at = NOW()
    WHERE id = v_order.id
      AND status = ANY(v_stale_statuses)
      AND created_at <= p_cutoff
      AND (payment_status = ANY(v_stale_payment_statuses) OR payment_status IS NULL);

    IF FOUND THEN
      v_cancelled := v_cancelled + 1;

      IF v_order.items IS NOT NULL AND jsonb_typeof(v_order.items->'cart_items') = 'array' THEN
        FOR v_item IN
          SELECT
            COALESCE(value->>'id', value->>'productId')::UUID AS id,
            COALESCE((value->>'quantity')::INTEGER, 0) AS quantity
          FROM jsonb_array_elements(v_order.items->'cart_items')
          WHERE COALESCE(value->>'id', value->>'productId') IS NOT NULL
            AND COALESCE(value->>'id', value->>'productId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND COALESCE(value->>'quantity', '0') ~ '^[0-9]+$'
        LOOP
          IF v_item.quantity > 0 THEN
            BEGIN
              PERFORM public.record_atomic_stock_movement(
                v_item.id,
                'return',
                v_item.quantity,
                v_order.id::TEXT,
                'online_order',
                'Reverted stock due to stale unpaid order auto-cancellation',
                TRUE,
                NULL
              );
              v_restored_items := v_restored_items + 1;
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'cancelled', v_cancelled,
    'restoredItems', v_restored_items
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_cancel_stale_orders_v1(TIMESTAMPTZ, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
