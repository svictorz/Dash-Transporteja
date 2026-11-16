-- Consulta limitada a dados operacionais de fretes reais para a Cotação.
-- Não altera routes, suas políticas RLS, nem cotações/análises existentes.
CREATE OR REPLACE FUNCTION public.erp_similar_freights(
  p_origin_city text,
  p_origin_state text,
  p_destination_city text,
  p_destination_state text,
  p_weight_kg numeric,
  p_distance_km numeric
)
RETURNS TABLE (
  freight_id bigint,
  origin text,
  origin_state text,
  destination text,
  destination_state text,
  weight_kg numeric,
  distance_km numeric,
  cubage_m3 numeric,
  nf_value numeric,
  freight_value numeric,
  created_at timestamptz,
  same_cities boolean,
  weight_close boolean,
  distance_close boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_has_any_role(
    ARRAY['admin','comercial','financeiro','fiscal','supervisor','operacional']::text[]
  ) THEN
    RAISE EXCEPTION 'Acesso à Cotação não autorizado';
  END IF;
  IF p_origin_city IS NULL OR btrim(p_origin_city) = ''
     OR p_destination_city IS NULL OR btrim(p_destination_city) = ''
     OR p_origin_state IS NULL OR p_destination_state IS NULL
     OR upper(btrim(p_origin_state)) !~ '^[A-Z]{2}$'
     OR upper(btrim(p_destination_state)) !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'Informe cidade e UF de origem e destino';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT r.freight_id, r.origin, r.origin_state, r.destination, r.destination_state,
      CASE WHEN regexp_replace(r.weight, '[^0-9,]', '', 'g') ~ '^[0-9]+(,[0-9]+)?$'
        THEN replace(regexp_replace(r.weight, '[^0-9,]', '', 'g'), ',', '.')::numeric
        ELSE NULL END AS weight_kg,
      r.distance_km::numeric AS distance_km, r.cubage_m3, r.nf_value,
      r.freight_value, r.created_at,
      translate(lower(btrim(r.origin)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
        = translate(lower(btrim(p_origin_city)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
        AND translate(lower(btrim(r.destination)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
        = translate(lower(btrim(p_destination_city)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') AS same_cities
    FROM public.routes r
    WHERE upper(btrim(r.origin_state)) = upper(btrim(p_origin_state))
      AND upper(btrim(r.destination_state)) = upper(btrim(p_destination_state))
      AND r.status IN ('inTransit','pickedUp','delivered','documentation')
      AND r.freight_value > 0
  ), ranked AS (
    SELECT c.*,
      COALESCE(p_weight_kg > 0 AND c.weight_kg BETWEEN p_weight_kg * 0.8 AND p_weight_kg * 1.2, false) AS weight_close,
      COALESCE(p_distance_km > 0 AND c.distance_km BETWEEN p_distance_km * 0.8 AND p_distance_km * 1.2, false) AS distance_close,
      COALESCE(abs(c.weight_kg - p_weight_kg) / nullif(p_weight_kg, 0), 10)
        + COALESCE(abs(c.distance_km - p_distance_km) / nullif(p_distance_km, 0), 10) AS difference_score
    FROM candidates c
  )
  SELECT x.freight_id, x.origin, x.origin_state, x.destination, x.destination_state,
    x.weight_kg, x.distance_km, x.cubage_m3, x.nf_value, x.freight_value,
    x.created_at, x.same_cities, x.weight_close, x.distance_close
  FROM ranked x
  ORDER BY x.same_cities DESC, (x.weight_close AND x.distance_close) DESC,
    x.weight_close DESC, x.distance_close DESC, x.difference_score ASC,
    x.created_at DESC, x.freight_id DESC
  LIMIT 5;
END $$;

REVOKE ALL ON FUNCTION public.erp_similar_freights(text,text,text,text,numeric,numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erp_similar_freights(text,text,text,text,numeric,numeric)
  TO authenticated;
NOTIFY pgrst, 'reload schema';
