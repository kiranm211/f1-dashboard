ALTER TABLE circuit_facts
ADD COLUMN IF NOT EXISTS circuit_key INTEGER;

WITH meeting_aliases AS (
    SELECT DISTINCT ON (m.circuit_key)
        m.circuit_key,
        trim(regexp_replace(lower(translate(coalesce(m.circuit_short_name, ''), 'áàâäãåéèêëíìîïóòôöõúùûüçñýÿÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑÝŸ', 'aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNYY')), '[^a-z0-9]+', ' ', 'g')) AS short_name_norm,
        trim(regexp_replace(lower(translate(coalesce(m.location, ''), 'áàâäãåéèêëíìîïóòôöõúùûüçñýÿÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑÝŸ', 'aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNYY')), '[^a-z0-9]+', ' ', 'g')) AS location_norm,
        trim(regexp_replace(lower(translate(coalesce(m.country_name, ''), 'áàâäãåéèêëíìîïóòôöõúùûüçñýÿÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑÝŸ', 'aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNYY')), '[^a-z0-9]+', ' ', 'g')) AS country_norm
    FROM meetings m
    WHERE m.circuit_key IS NOT NULL
    ORDER BY m.circuit_key, m.date_start DESC
)
UPDATE circuit_facts cf
SET circuit_key = ma.circuit_key,
    updated_at = NOW()
FROM meeting_aliases ma
WHERE (
    trim(regexp_replace(lower(translate(coalesce(cf.circuit_short_name, ''), 'áàâäãåéèêëíìîïóòôöõúùûüçñýÿÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑÝŸ', 'aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNYY')), '[^a-z0-9]+', ' ', 'g')) IN (ma.short_name_norm, ma.location_norm, ma.country_norm)
    OR trim(regexp_replace(lower(translate(coalesce(cf.canonical_name, ''), 'áàâäãåéèêëíìîïóòôöõúùûüçñýÿÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑÝŸ', 'aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNYY')), '[^a-z0-9]+', ' ', 'g')) IN (ma.short_name_norm, ma.location_norm, ma.country_norm)
)
AND cf.circuit_key IS DISTINCT FROM ma.circuit_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_circuit_facts_circuit_key ON circuit_facts(circuit_key) WHERE circuit_key IS NOT NULL;
