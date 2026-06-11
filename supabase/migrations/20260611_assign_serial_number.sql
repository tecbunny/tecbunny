-- Create an atomic function in your Supabase SQL editor
CREATE OR REPLACE FUNCTION assign_serial_number(target_product_id UUID)
RETURNS TEXT AS $$
DECLARE
  assigned_serial TEXT;
BEGIN
  SELECT serial_number INTO assigned_serial
  FROM inventory_serials
  WHERE product_id = target_product_id AND status = 'available'
  LIMIT 1
  FOR UPDATE SKIP LOCKED; -- Locks the row, ignores already-locked rows

  IF assigned_serial IS NOT NULL THEN
    UPDATE inventory_serials 
    SET status = 'sold' 
    WHERE serial_number = assigned_serial;
  END IF;

  RETURN assigned_serial;
END;
$$ LANGUAGE plpgsql;
