-- Migration 008: get_note_counts RPC
-- Replaces full-table scan with a GROUP BY aggregate.
-- Returns one row per folder instead of one row per note.

CREATE OR REPLACE FUNCTION public.get_note_counts()
RETURNS TABLE(folder_name text, folder_id text, cnt bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT
    folder_name,
    folder_id::text,
    COUNT(*)::bigint AS cnt
  FROM public.notes
  WHERE is_folder = false
  GROUP BY folder_name, folder_id;
$$;
