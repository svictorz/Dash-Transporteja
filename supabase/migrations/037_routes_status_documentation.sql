-- Adiciona o status "Documentação" (documentation) às rotas.

ALTER TABLE public.routes DROP CONSTRAINT IF EXISTS routes_status_check;

ALTER TABLE public.routes
  ADD CONSTRAINT routes_status_check
  CHECK (status IN ('pending', 'inTransit', 'pickedUp', 'delivered', 'documentation', 'cancelled'));
