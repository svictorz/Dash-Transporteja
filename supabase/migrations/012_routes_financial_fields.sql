-- Adiciona campos financeiros detalhados nas rotas/fretes
ALTER TABLE public.routes
ADD COLUMN IF NOT EXISTS freight_value NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS driver_value NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS taxes_value NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS net_freight_value NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS commission_value NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS payment_status TEXT,
ADD COLUMN IF NOT EXISTS payment_type TEXT,
ADD COLUMN IF NOT EXISTS driver_name TEXT,
ADD COLUMN IF NOT EXISTS driver_phone TEXT,
ADD COLUMN IF NOT EXISTS driver_payment_status TEXT,
ADD COLUMN IF NOT EXISTS driver_payment_type TEXT;
