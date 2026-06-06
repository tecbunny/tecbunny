-- Lock down operational inventory tables that are exposed through the public schema.
-- Supabase requires RLS on exposed-schema tables; these policies keep direct
-- browser access limited to authenticated staff while server RPCs continue to
-- perform atomic stock mutations.

DO $$
BEGIN
  IF to_regclass('public.inventory') IS NOT NULL THEN
    ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS inventory_staff_select ON public.inventory;
    DROP POLICY IF EXISTS inventory_staff_insert ON public.inventory;
    DROP POLICY IF EXISTS inventory_staff_update ON public.inventory;
    DROP POLICY IF EXISTS inventory_staff_delete ON public.inventory;

    CREATE POLICY inventory_staff_select
      ON public.inventory
      FOR SELECT
      TO authenticated
      USING ((select public.is_staff_member()));

    CREATE POLICY inventory_staff_insert
      ON public.inventory
      FOR INSERT
      TO authenticated
      WITH CHECK ((select public.is_staff_member()));

    CREATE POLICY inventory_staff_update
      ON public.inventory
      FOR UPDATE
      TO authenticated
      USING ((select public.is_staff_member()))
      WITH CHECK ((select public.is_staff_member()));

    CREATE POLICY inventory_staff_delete
      ON public.inventory
      FOR DELETE
      TO authenticated
      USING ((select public.is_staff_member()));
  END IF;

  IF to_regclass('public.stock_movements') IS NOT NULL THEN
    ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS stock_movements_staff_select ON public.stock_movements;
    DROP POLICY IF EXISTS stock_movements_staff_insert ON public.stock_movements;

    CREATE POLICY stock_movements_staff_select
      ON public.stock_movements
      FOR SELECT
      TO authenticated
      USING ((select public.is_staff_member()));

    CREATE POLICY stock_movements_staff_insert
      ON public.stock_movements
      FOR INSERT
      TO authenticated
      WITH CHECK ((select public.is_staff_member()));
  END IF;

  IF to_regclass('public.purchases') IS NOT NULL THEN
    ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS purchases_staff_select ON public.purchases;
    DROP POLICY IF EXISTS purchases_staff_insert ON public.purchases;
    DROP POLICY IF EXISTS purchases_staff_update ON public.purchases;
    DROP POLICY IF EXISTS purchases_staff_delete ON public.purchases;

    CREATE POLICY purchases_staff_select
      ON public.purchases
      FOR SELECT
      TO authenticated
      USING ((select public.is_staff_member()));

    CREATE POLICY purchases_staff_insert
      ON public.purchases
      FOR INSERT
      TO authenticated
      WITH CHECK ((select public.is_staff_member()));

    CREATE POLICY purchases_staff_update
      ON public.purchases
      FOR UPDATE
      TO authenticated
      USING ((select public.is_staff_member()))
      WITH CHECK ((select public.is_staff_member()));

    CREATE POLICY purchases_staff_delete
      ON public.purchases
      FOR DELETE
      TO authenticated
      USING ((select public.is_staff_member()));
  END IF;
END $$;
