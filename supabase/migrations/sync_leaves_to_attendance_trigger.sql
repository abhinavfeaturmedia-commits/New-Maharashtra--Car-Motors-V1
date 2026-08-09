-- ==============================================================================
-- SYNC APPROVED LEAVES TO ATTENDANCE RECORDS TRIGGER
-- Run this in: Supabase → SQL Editor → New Query
-- ==============================================================================

CREATE OR REPLACE FUNCTION sync_approved_leave_to_attendance()
RETURNS TRIGGER AS $$
DECLARE
  v_date DATE;
  v_dow INT;
  v_is_holiday BOOLEAN;
BEGIN
  -- If it was previously approved, clean up the old records first (handles changes in dates or status downgrade)
  IF (TG_OP = 'UPDATE' AND OLD.status = 'approved') OR (TG_OP = 'DELETE' AND OLD.status = 'approved') THEN
    DELETE FROM public.attendance_records
    WHERE leave_request_id = OLD.id;
  END IF;

  -- If it is approved (either inserted as approved, or updated to approved, or dates changed while approved)
  IF (TG_OP = 'INSERT' AND NEW.status = 'approved') OR 
     (TG_OP = 'UPDATE' AND NEW.status = 'approved') THEN
     
    v_date := NEW.start_date;
    WHILE v_date <= NEW.end_date LOOP
      v_dow := EXTRACT(DOW FROM v_date);
      
      -- Check if it's a holiday
      SELECT EXISTS (
        SELECT 1 FROM public.attendance_holidays WHERE date = v_date
      ) INTO v_is_holiday;
      
      -- Exclude weekends (0 = Sunday, 6 = Saturday) and holidays
      IF v_dow NOT IN (0, 6) AND NOT v_is_holiday THEN
        INSERT INTO public.attendance_records (
          user_id,
          date,
          status,
          leave_request_id,
          admin_note
        )
        VALUES (
          NEW.user_id,
          v_date,
          'on_leave',
          NEW.id,
          COALESCE(NEW.reason, 'Approved Leave')
        )
        ON CONFLICT (user_id, date) DO UPDATE
        SET status = 'on_leave',
            leave_request_id = NEW.id,
            admin_note = COALESCE(NEW.reason, 'Approved Leave');
      END IF;
      
      v_date := v_date + 1;
    END LOOP;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_approved_leave ON public.leave_requests;
CREATE TRIGGER trigger_sync_approved_leave
AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION sync_approved_leave_to_attendance();
