-- Pin search_path on SECURITY DEFINER helpers (Supabase linter:
-- function_search_path_mutable). ALTER ... SET leaves each body untouched.
ALTER FUNCTION public.is_workspace_member(uuid)  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_workspace_admin(uuid)   SET search_path = public, pg_temp;
ALTER FUNCTION public.is_workspace_owner(uuid)   SET search_path = public, pg_temp;
ALTER FUNCTION public.is_workspace_editor(uuid)  SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_workspace()     SET search_path = public, pg_temp;
ALTER FUNCTION public.set_task_workspace_id()    SET search_path = public, pg_temp;
ALTER FUNCTION public.safe_timezone(text)        SET search_path = public, pg_temp;
ALTER FUNCTION public.get_due_rhythm_nudges()    SET search_path = public, pg_temp;
