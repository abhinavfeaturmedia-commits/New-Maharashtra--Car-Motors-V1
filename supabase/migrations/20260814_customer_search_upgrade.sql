-- Upgraded Search Customers by Text Function
-- Supports normalized queries, deals, sales, inventory, car interests, leads, documents, and registration numbers

CREATE OR REPLACE FUNCTION public.search_customers_by_text(search_term text)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  WITH normalized AS (
    SELECT 
      TRIM(search_term) AS q,
      REGEXP_REPLACE(search_term, '[^a-zA-Z0-9]', '', 'g') AS clean_q
  )
  SELECT DISTINCT c.id 
  FROM public.customers c
  CROSS JOIN normalized n
  LEFT JOIN public.sales s ON s.customer_id = c.id
  LEFT JOIN public.inventory s_inv ON s_inv.id = s.inventory_id
  LEFT JOIN public.customer_deals cd ON cd.customer_id = c.id
  LEFT JOIN public.inventory cd_inv ON cd_inv.id = cd.inventory_id
  LEFT JOIN public.lead_car_interests lci ON lci.customer_id = c.id
  LEFT JOIN public.inventory lci_inv ON lci_inv.id = lci.inventory_id
  LEFT JOIN public.leads l ON l.customer_id = c.id
  LEFT JOIN public.customer_documents doc ON doc.customer_id = c.id
  WHERE
    -- Customer personal info
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
    -- Sales & Inventory joined
    OR s_inv.make ILIKE '%' || n.q || '%'
    OR s_inv.model ILIKE '%' || n.q || '%'
    OR s_inv.variant ILIKE '%' || n.q || '%'
    OR s_inv.registration_no ILIKE '%' || n.q || '%'
    OR REGEXP_REPLACE(COALESCE(s_inv.registration_no, ''), '[^a-zA-Z0-9]', '', 'g') ILIKE '%' || n.clean_q || '%'
    OR (s_inv.make || ' ' || s_inv.model) ILIKE '%' || n.q || '%'
    -- Customer Deals joined
    OR cd_inv.make ILIKE '%' || n.q || '%'
    OR cd_inv.model ILIKE '%' || n.q || '%'
    OR cd_inv.variant ILIKE '%' || n.q || '%'
    OR cd_inv.registration_no ILIKE '%' || n.q || '%'
    OR REGEXP_REPLACE(COALESCE(cd_inv.registration_no, ''), '[^a-zA-Z0-9]', '', 'g') ILIKE '%' || n.clean_q || '%'
    OR (cd_inv.make || ' ' || cd_inv.model) ILIKE '%' || n.q || '%'
    -- Car Interests joined
    OR lci_inv.make ILIKE '%' || n.q || '%'
    OR lci_inv.model ILIKE '%' || n.q || '%'
    OR lci_inv.registration_no ILIKE '%' || n.q || '%'
    OR REGEXP_REPLACE(COALESCE(lci_inv.registration_no, ''), '[^a-zA-Z0-9]', '', 'g') ILIKE '%' || n.clean_q || '%'
    -- Linked Leads
    OR l.full_name ILIKE '%' || n.q || '%'
    OR l.phone ILIKE '%' || n.q || '%'
    OR l.car_make ILIKE '%' || n.q || '%'
    OR l.car_model ILIKE '%' || n.q || '%'
    -- Customer Documents
    OR doc.doc_type ILIKE '%' || n.q || '%'
    OR doc.doc_label ILIKE '%' || n.q || '%'
    OR doc.file_name ILIKE '%' || n.q || '%'
    OR doc.notes ILIKE '%' || n.q || '%'
$function$;
