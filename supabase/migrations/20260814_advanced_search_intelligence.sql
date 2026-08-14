-- Advanced Search Intelligence & CRM Features
-- Enables pg_trgm for typo-tolerant fuzzy matching and returns rich match reasoning

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

DROP FUNCTION IF EXISTS public.search_customers_by_text(text);

CREATE OR REPLACE FUNCTION public.search_customers_by_text(search_term text)
RETURNS TABLE(id uuid, match_type text, match_snippet text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $function$
  WITH normalized AS (
    SELECT 
      TRIM(search_term) AS q,
      REGEXP_REPLACE(search_term, '[^a-zA-Z0-9]', '', 'g') AS clean_q
  ),
  matched_records AS (
    -- 1. Matched on Customer Contact / Profile
    SELECT 
      c.id,
      'contact'::text AS match_type,
      CASE 
        WHEN c.full_name ILIKE '%' || n.q || '%' THEN '👤 ' || c.full_name
        WHEN c.phone ILIKE '%' || n.q || '%' OR REGEXP_REPLACE(COALESCE(c.phone, ''), '[^0-9]', '', 'g') ILIKE '%' || n.clean_q || '%' THEN '📞 ' || c.phone
        WHEN c.city ILIKE '%' || n.q || '%' THEN '📍 ' || c.city
        WHEN c.occupation ILIKE '%' || n.q || '%' THEN '💼 ' || c.occupation
        WHEN c.email ILIKE '%' || n.q || '%' THEN '✉️ ' || c.email
        WHEN c.notes ILIKE '%' || n.q || '%' THEN '📝 ' || LEFT(c.notes, 35)
        WHEN extensions.similarity(c.full_name, n.q) > 0.3 THEN '👤 ' || c.full_name
        ELSE '👤 Profile Match'
      END AS match_snippet
    FROM public.customers c
    CROSS JOIN normalized n
    WHERE 
      c.full_name ILIKE '%' || n.q || '%'
      OR c.phone ILIKE '%' || n.q || '%'
      OR REGEXP_REPLACE(COALESCE(c.phone, ''), '[^0-9]', '', 'g') ILIKE '%' || n.clean_q || '%'
      OR c.alternate_phone ILIKE '%' || n.q || '%'
      OR REGEXP_REPLACE(COALESCE(c.alternate_phone, ''), '[^0-9]', '', 'g') ILIKE '%' || n.clean_q || '%'
      OR c.whatsapp_number ILIKE '%' || n.q || '%'
      OR REGEXP_REPLACE(COALESCE(c.whatsapp_number, ''), '[^0-9]', '', 'g') ILIKE '%' || n.clean_q || '%'
      OR c.email ILIKE '%' || n.q || '%'
      OR c.city ILIKE '%' || n.q || '%'
      OR c.address ILIKE '%' || n.q || '%'
      OR c.office_address ILIKE '%' || n.q || '%'
      OR c.occupation ILIKE '%' || n.q || '%'
      OR c.notes ILIKE '%' || n.q || '%'
      OR (LENGTH(n.q) >= 3 AND extensions.similarity(c.full_name, n.q) > 0.3)

    UNION ALL

    -- 2. Matched on Purchased Vehicle (sales -> inventory)
    SELECT 
      c.id,
      'vehicle'::text AS match_type,
      '🚗 ' || COALESCE(s_inv.year::text || ' ', '') || s_inv.make || ' ' || s_inv.model || COALESCE(' (' || s_inv.registration_no || ')', '') AS match_snippet
    FROM public.customers c
    CROSS JOIN normalized n
    JOIN public.sales s ON s.customer_id = c.id
    JOIN public.inventory s_inv ON s_inv.id = s.inventory_id
    WHERE
      s_inv.make ILIKE '%' || n.q || '%'
      OR s_inv.model ILIKE '%' || n.q || '%'
      OR s_inv.variant ILIKE '%' || n.q || '%'
      OR s_inv.registration_no ILIKE '%' || n.q || '%'
      OR REGEXP_REPLACE(COALESCE(s_inv.registration_no, ''), '[^a-zA-Z0-9]', '', 'g') ILIKE '%' || n.clean_q || '%'
      OR (s_inv.make || ' ' || s_inv.model) ILIKE '%' || n.q || '%'
      OR (LENGTH(n.q) >= 3 AND extensions.similarity(s_inv.make || ' ' || s_inv.model, n.q) > 0.3)

    UNION ALL

    -- 3. Matched on Customer Deals (customer_deals -> inventory)
    SELECT 
      c.id,
      'vehicle'::text AS match_type,
      '🏷️ ' || COALESCE(cd_inv.year::text || ' ', '') || cd_inv.make || ' ' || cd_inv.model || COALESCE(' (' || cd_inv.registration_no || ')', '') AS match_snippet
    FROM public.customers c
    CROSS JOIN normalized n
    JOIN public.customer_deals cd ON cd.customer_id = c.id
    JOIN public.inventory cd_inv ON cd_inv.id = cd.inventory_id
    WHERE
      cd_inv.make ILIKE '%' || n.q || '%'
      OR cd_inv.model ILIKE '%' || n.q || '%'
      OR cd_inv.variant ILIKE '%' || n.q || '%'
      OR cd_inv.registration_no ILIKE '%' || n.q || '%'
      OR REGEXP_REPLACE(COALESCE(cd_inv.registration_no, ''), '[^a-zA-Z0-9]', '', 'g') ILIKE '%' || n.clean_q || '%'
      OR (cd_inv.make || ' ' || cd_inv.model) ILIKE '%' || n.q || '%'

    UNION ALL

    -- 4. Matched on Vault Documents
    SELECT 
      c.id,
      'document'::text AS match_type,
      '📄 ' || COALESCE(doc.doc_label, doc.file_name, doc.doc_type) AS match_snippet
    FROM public.customers c
    CROSS JOIN normalized n
    JOIN public.customer_documents doc ON doc.customer_id = c.id
    WHERE
      doc.doc_type ILIKE '%' || n.q || '%'
      OR doc.doc_label ILIKE '%' || n.q || '%'
      OR doc.file_name ILIKE '%' || n.q || '%'
      OR doc.notes ILIKE '%' || n.q || '%'

    UNION ALL

    -- 5. Matched on Leads / Interests
    SELECT 
      c.id,
      'lead'::text AS match_type,
      '🎯 Interest: ' || COALESCE(l.car_make || ' ' || l.car_model, lci_inv.make || ' ' || lci_inv.model, 'Inquiry') AS match_snippet
    FROM public.customers c
    CROSS JOIN normalized n
    LEFT JOIN public.leads l ON l.customer_id = c.id
    LEFT JOIN public.lead_car_interests lci ON lci.customer_id = c.id
    LEFT JOIN public.inventory lci_inv ON lci_inv.id = lci.inventory_id
    WHERE
      l.full_name ILIKE '%' || n.q || '%'
      OR l.phone ILIKE '%' || n.q || '%'
      OR l.car_make ILIKE '%' || n.q || '%'
      OR l.car_model ILIKE '%' || n.q || '%'
      OR lci_inv.make ILIKE '%' || n.q || '%'
      OR lci_inv.model ILIKE '%' || n.q || '%'
      OR lci_inv.registration_no ILIKE '%' || n.q || '%'
  )
  -- Return grouped by id with the highest priority match type & snippet
  SELECT DISTINCT ON (m.id)
    m.id,
    m.match_type,
    m.match_snippet
  FROM matched_records m
  ORDER BY m.id, 
    CASE m.match_type 
      WHEN 'vehicle' THEN 1 
      WHEN 'document' THEN 2 
      WHEN 'contact' THEN 3 
      WHEN 'lead' THEN 4 
      ELSE 5 
    END;
$function$;
