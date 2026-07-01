-- SQL script to prepare PostgreSQL Full Text Search for the vet_kb table

-- 1. Create a generated tsvector column on the vet_kb table
-- This column automatically concatenates and tokenizes the relevant text columns,
-- assigning higher weights ('A') to titles and summaries, and lower weights to full text and metadata.
ALTER TABLE vet_kb 
ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(concise_summary, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(body_system, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(species, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(array_to_string(symptom_list, ' '), '')), 'C') ||
  setweight(to_tsvector('english', coalesce(array_to_string(condition_tags, ' '), '')), 'C') ||
  setweight(to_tsvector('english', coalesce(array_to_string(breed, ' '), '')), 'D') ||
  setweight(to_tsvector('english', coalesce(full_text, '')), 'D')
) STORED;

-- 2. Create a GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS vet_kb_fts_idx ON vet_kb USING gin(fts);

-- 3. Define the RPC function to run the ranked full-text query
DROP FUNCTION IF EXISTS match_vet_kb_bm25(text, int);

CREATE OR REPLACE FUNCTION match_vet_kb_bm25(query_text text, match_count int)
RETURNS TABLE (
  title text,
  species text,
  breed text[],
  symptom_list text[],
  condition_tags text[],
  body_system text,
  severity text,
  concise_summary text,
  full_text text,
  source text,
  source_url text,
  relevance_score float4
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.title,
    v.species,
    v.breed,
    v.symptom_list,
    v.condition_tags,
    v.body_system,
    v.severity,
    v.concise_summary,
    v.full_text,
    v.source,
    v.source_url,
    ts_rank(v.fts, websearch_to_tsquery('english', query_text)) AS relevance_score
  FROM vet_kb v
  WHERE v.fts @@ websearch_to_tsquery('english', query_text)
  ORDER BY relevance_score DESC
  LIMIT match_count;
END;
$$;
