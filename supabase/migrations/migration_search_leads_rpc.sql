CREATE OR REPLACE FUNCTION search_leads_by_text(search_term TEXT)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT l.id
  FROM leads l
  WHERE 
    search_term IS NULL OR search_term = '' OR
    -- Leads table fields
    l.full_name ILIKE '%' || search_term || '%' OR
    l.phone ILIKE '%' || search_term || '%' OR
    l.email ILIKE '%' || search_term || '%' OR
    l.type ILIKE '%' || search_term || '%' OR
    l.source ILIKE '%' || search_term || '%' OR
    l.status ILIKE '%' || search_term || '%' OR
    l.notes ILIKE '%' || search_term || '%' OR
    l.car_make ILIKE '%' || search_term || '%' OR
    l.car_model ILIKE '%' || search_term || '%' OR
    l.budget ILIKE '%' || search_term || '%' OR
    l.message ILIKE '%' || search_term || '%' OR
    l.lead_quality ILIKE '%' || search_term || '%' OR
    (l.personal_address IS NOT NULL AND l.personal_address ILIKE '%' || search_term || '%') OR
    (l.office_address IS NOT NULL AND l.office_address ILIKE '%' || search_term || '%') OR
    (l.secondary_phone IS NOT NULL AND l.secondary_phone ILIKE '%' || search_term || '%') OR
    (l.whatsapp_number IS NOT NULL AND l.whatsapp_number ILIKE '%' || search_term || '%') OR
    -- Subqueries for relations
    EXISTS (
      SELECT 1 FROM lead_car_interests lci
      LEFT JOIN inventory i ON lci.inventory_id = i.id
      LEFT JOIN dealers d ON i.dealer_id = d.id
      WHERE lci.lead_id = l.id AND (
        (lci.notes IS NOT NULL AND lci.notes ILIKE '%' || search_term || '%') OR
        (lci.custom_make IS NOT NULL AND lci.custom_make ILIKE '%' || search_term || '%') OR
        (lci.custom_model IS NOT NULL AND lci.custom_model ILIKE '%' || search_term || '%') OR
        (i.make IS NOT NULL AND i.make ILIKE '%' || search_term || '%') OR
        (i.model IS NOT NULL AND i.model ILIKE '%' || search_term || '%') OR
        (i.registration_no IS NOT NULL AND i.registration_no ILIKE '%' || search_term || '%') OR
        (d.name IS NOT NULL AND d.name ILIKE '%' || search_term || '%') OR
        (d.dealer_code IS NOT NULL AND d.dealer_code ILIKE '%' || search_term || '%')
      )
    ) OR
    EXISTS (
      SELECT 1 FROM follow_ups fu
      WHERE fu.lead_id = l.id AND (
        (fu.notes IS NOT NULL AND fu.notes ILIKE '%' || search_term || '%') OR
        (fu.type IS NOT NULL AND fu.type ILIKE '%' || search_term || '%')
      )
    );
END;
$$;
