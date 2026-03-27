-- ============================================
-- SETUP COMPLETO DO SUPABASE - TRANSPORTEJÁ
-- ============================================
-- Execute este script completo no SQL Editor do Supabase
-- Dashboard > SQL Editor > New Query > Cole este conteúdo > Run

-- ============================================
-- 1. EXTENSÕES
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. TABELAS
-- ============================================

-- Tabela de usuários (estende auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'driver')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de motoristas
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  cnh TEXT NOT NULL,
  vehicle TEXT NOT NULL,
  plate TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'onRoute')),
  location TEXT,
  last_checkin TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  responsible TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  extension TEXT,
  city TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de rotas
CREATE TABLE IF NOT EXISTS public.routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  freight_id BIGINT NOT NULL UNIQUE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
  origin TEXT NOT NULL,
  origin_state TEXT NOT NULL,
  origin_address TEXT,
  destination TEXT NOT NULL,
  destination_state TEXT NOT NULL,
  destination_address TEXT,
  vehicle TEXT NOT NULL,
  plate TEXT NOT NULL,
  weight TEXT NOT NULL,
  estimated_delivery TEXT NOT NULL,
  pickup_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'inTransit', 'pickedUp', 'delivered', 'cancelled')),
  company_name TEXT,
  company_responsible TEXT,
  company_phone TEXT,
  company_email TEXT,
  company_address TEXT,
  company_city TEXT,
  company_state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de check-ins
CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('pickup', 'delivery')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  photo_url TEXT NOT NULL,
  coords_lat DOUBLE PRECISION NOT NULL,
  coords_lng DOUBLE PRECISION NOT NULL,
  address TEXT,
  distance DOUBLE PRECISION,
  freight_id BIGINT REFERENCES public.routes(freight_id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON public.drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers(status);
CREATE INDEX IF NOT EXISTS idx_routes_driver_id ON public.routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_routes_freight_id ON public.routes(freight_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON public.routes(status);
CREATE INDEX IF NOT EXISTS idx_checkins_freight_id ON public.checkins(freight_id);
CREATE INDEX IF NOT EXISTS idx_checkins_driver_id ON public.checkins(driver_id);
CREATE INDEX IF NOT EXISTS idx_checkins_route_id ON public.checkins(route_id);
CREATE INDEX IF NOT EXISTS idx_checkins_timestamp ON public.checkins(timestamp);
CREATE INDEX IF NOT EXISTS idx_checkins_type ON public.checkins(type);

-- ============================================
-- 4. FUNÇÕES E TRIGGERS
-- ============================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para auto-update de updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_drivers_updated_at ON public.drivers;
CREATE TRIGGER update_drivers_updated_at 
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at 
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_routes_updated_at ON public.routes;
CREATE TRIGGER update_routes_updated_at 
  BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para criar perfil de usuário automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'operator')::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read drivers" ON public.drivers;
DROP POLICY IF EXISTS "Admins and operators can modify drivers" ON public.drivers;
DROP POLICY IF EXISTS "Authenticated users can read clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and operators can modify clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can read routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and operators can modify routes" ON public.routes;
DROP POLICY IF EXISTS "Drivers can read own routes" ON public.routes;
DROP POLICY IF EXISTS "Authenticated users can read checkins" ON public.checkins;
DROP POLICY IF EXISTS "Authenticated users can insert checkins" ON public.checkins;
DROP POLICY IF EXISTS "Admins and operators can modify checkins" ON public.checkins;

-- Políticas para USERS
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can read all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update all users" ON public.users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Políticas para DRIVERS
CREATE POLICY "Authenticated users can read drivers" ON public.drivers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and operators can insert drivers" ON public.drivers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );

CREATE POLICY "Admins and operators can update drivers" ON public.drivers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );

CREATE POLICY "Admins and operators can delete drivers" ON public.drivers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );

-- Políticas para CLIENTS
CREATE POLICY "Authenticated users can read clients" ON public.clients
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and operators can insert clients" ON public.clients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );

CREATE POLICY "Admins and operators can update clients" ON public.clients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );

CREATE POLICY "Admins and operators can delete clients" ON public.clients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );

-- Políticas para ROUTES
CREATE POLICY "Authenticated users can read routes" ON public.routes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and operators can insert routes" ON public.routes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );

CREATE POLICY "Admins and operators can update routes" ON public.routes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );

CREATE POLICY "Admins and operators can delete routes" ON public.routes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );

-- Políticas para CHECKINS
CREATE POLICY "Authenticated users can read checkins" ON public.checkins
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert checkins" ON public.checkins
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins and operators can update checkins" ON public.checkins
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );

CREATE POLICY "Admins and operators can delete checkins" ON public.checkins
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );

-- ============================================
-- 6. DADOS INICIAIS (OPCIONAL)
-- ============================================
-- Descomente e ajuste se quiser criar dados de exemplo

/*
-- Exemplo de motorista (após criar um usuário primeiro)
INSERT INTO public.drivers (user_id, name, phone, email, cnh, vehicle, plate, status)
VALUES (
  'uuid-do-usuario-aqui',
  'José Silva',
  '(11) 99999-1111',
  'jose@transporteja.com',
  '12345678901',
  'Mercedes-Benz Actros',
  'ABC-1234',
  'active'
);
*/

-- ============================================
-- FIM DO SETUP
-- ============================================
-- Após executar este script:
-- 1. Configure o Storage bucket (veja instruções abaixo)
-- 2. Crie usuários em Authentication > Users
-- 3. Teste o sistema!

