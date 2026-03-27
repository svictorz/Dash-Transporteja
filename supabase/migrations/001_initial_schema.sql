-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'comercial' CHECK (role IN ('admin', 'comercial', 'driver')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drivers table
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

-- Clients table
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

-- Routes table
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

-- Checkins table
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

-- Indexes for performance
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own data
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Policy: Admins can read all users
CREATE POLICY "Admins can read all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Anyone authenticated can read drivers
CREATE POLICY "Authenticated users can read drivers" ON public.drivers
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Admins and operators can modify drivers
CREATE POLICY "Admins and operators can modify drivers" ON public.drivers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
  );

-- Policy: Anyone authenticated can read clients
CREATE POLICY "Authenticated users can read clients" ON public.clients
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Admins and operators can modify clients
CREATE POLICY "Admins and operators can modify clients" ON public.clients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
  );

-- Policy: Anyone authenticated can read routes
CREATE POLICY "Authenticated users can read routes" ON public.routes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Admins and operators can modify routes
CREATE POLICY "Admins and operators can modify routes" ON public.routes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
  );

-- Policy: Drivers can read their own routes
CREATE POLICY "Drivers can read own routes" ON public.routes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.drivers
      WHERE id = driver_id AND user_id = auth.uid()
    )
  );

-- Policy: Anyone authenticated can read checkins
CREATE POLICY "Authenticated users can read checkins" ON public.checkins
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Anyone authenticated can insert checkins
CREATE POLICY "Authenticated users can insert checkins" ON public.checkins
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Admins and operators can modify checkins
CREATE POLICY "Admins and operators can modify checkins" ON public.checkins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
  );

