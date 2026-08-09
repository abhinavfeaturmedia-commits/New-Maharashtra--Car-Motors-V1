DO $$ 
DECLARE
  constname text;
BEGIN
  SELECT conname INTO constname
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.conrelid = 'follow_ups'::regclass AND a.attname = 'contacted_via';

  IF constname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE follow_ups DROP CONSTRAINT ' || constname;
  END IF;
END $$;

ALTER TABLE follow_ups ALTER COLUMN contacted_via DROP DEFAULT;
ALTER TABLE follow_ups ALTER COLUMN contacted_via TYPE text[] USING ARRAY[contacted_via];
ALTER TABLE follow_ups ALTER COLUMN contacted_via SET DEFAULT ARRAY['call']::text[];
