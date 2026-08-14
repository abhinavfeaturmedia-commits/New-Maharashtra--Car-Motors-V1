-- ============================================================
-- MAHARASHTRA MOTORS — ADMIN USER MANAGEMENT MIGRATION
-- 1. Auto-Confirm Trigger for new & existing auth users
-- 2. Admin Direct Password Change RPC
-- 3. Admin User Deletion RPC with Safe Cascading
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 1. AUTO-CONFIRM TRIGGER ON auth.users
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_auto_confirm_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_auto_confirm_user ON auth.users;
CREATE TRIGGER tr_auto_confirm_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auto_confirm_user();

-- Auto-confirm all existing unconfirmed accounts
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. ADMIN DIRECT PASSWORD CHANGE RPC FUNCTION
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_change_user_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role TEXT;
  target_user_email TEXT;
BEGIN
  -- 1. Verify caller has admin or owner role in public.profiles
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can reset user passwords.';
  END IF;

  -- 2. Validate password length
  IF length(new_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters long.';
  END IF;

  -- 3. Update auth.users encrypted password via bcrypt
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = target_user_id
  RETURNING email INTO target_user_email;

  IF target_user_email IS NULL THEN
    RAISE EXCEPTION 'Target user not found in authentication registry.';
  END IF;

  -- 4. Record entry in audit logs if table exists
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, target_type, target_name, details)
    VALUES (
      auth.uid(),
      'Password Reset',
      'Staff Account',
      target_user_email,
      'Administrator directly updated staff user password'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Continue even if audit_logs table has schema divergence
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Password updated successfully.',
    'email', target_user_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_change_user_password(UUID, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. ADMIN DIRECT USER DELETION RPC FUNCTION
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  target_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role TEXT;
  target_user_email TEXT;
  target_user_name TEXT;
BEGIN
  -- 1. Prevent self-deletion
  IF auth.uid() = target_user_id THEN
    RAISE EXCEPTION 'Action denied: You cannot delete your own logged-in account.';
  END IF;

  -- 2. Verify caller has admin or owner role
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can delete users.';
  END IF;

  -- 3. Get user info for audit logging
  SELECT email, full_name INTO target_user_email, target_user_name
  FROM public.profiles
  WHERE id = target_user_id;

  IF target_user_email IS NULL THEN
    SELECT email INTO target_user_email FROM auth.users WHERE id = target_user_id;
  END IF;

  -- 4. Clean up relational references safely without breaking foreign keys
  -- Detach lead assignments
  UPDATE public.leads SET assigned_to = NULL WHERE assigned_to = target_user_id;

  -- Detach sales attribution
  UPDATE public.sales SET sold_by = NULL WHERE sold_by = target_user_id;

  -- Detach shared catalogs creator
  UPDATE public.shared_catalogs SET created_by = NULL WHERE created_by = target_user_id;

  -- Delete attendance records
  DELETE FROM public.attendance_records WHERE staff_id = target_user_id;

  -- Delete user permissions
  DELETE FROM public.user_permissions WHERE user_id = target_user_id;

  -- Delete from public.profiles
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;

  -- 5. Record entry in audit logs
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, target_type, target_name, details)
    VALUES (
      auth.uid(),
      'User Deleted',
      'Staff Account',
      COALESCE(target_user_name, target_user_email, 'Staff User'),
      format('Deleted staff account (%s)', COALESCE(target_user_email, target_user_id::text))
    );
  EXCEPTION WHEN OTHERS THEN
    -- Continue if audit log is optional
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User account permanently deleted.',
    'deleted_user_id', target_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
