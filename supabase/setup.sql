-- =============================================================
-- RUN THIS IN YOUR SUPABASE SQL EDITOR (Dashboard > SQL Editor)
-- =============================================================

-- 1. Create the projects table
CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  number TEXT NOT NULL,
  state TEXT DEFAULT 'TX',
  manager TEXT NOT NULL,
  type TEXT DEFAULT 'TFO',
  go_by TEXT DEFAULT '',
  kick_off DATE,
  qcll DATE,
  pcd DATE,
  fee NUMERIC DEFAULT 0,
  target_hours NUMERIC DEFAULT 0,
  hours_spent NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (required by Supabase)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 3. Create a policy that allows full access (since no auth needed)
CREATE POLICY "Allow full access" ON projects
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Create an auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_modtime
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 5. Seed your existing project data
INSERT INTO projects (name, number, state, manager, type, go_by, kick_off, qcll, pcd, fee, target_hours, hours_spent) VALUES
  ('The Rustic - Houston, TX', 'FRC25002', 'TX', 'MJ', 'Ground up', 'YES', '2025-11-18', '2026-01-07', '2026-01-27', 18000, 164, 0.5),
  ('SteakHouse, Kingwood, TX', 'CEI25002', 'TX', 'MJ', 'TFO', '', '2025-10-09', '2025-10-09', '2026-01-20', 7000, 64, 1),
  ('Moxies - Austin, TX (Domain)', 'MOX25001', 'TX', 'MJ', 'TFO', 'Chopshop-Alpharetta', '2025-08-27', '2026-01-06', '2026-01-08', 10000, 91, 1),
  ('Portillo''s - Baytown, TX', 'PHD25001', 'TX', 'EM', 'Ground up', '', '2025-08-22', '2025-10-01', '2025-10-08', 1800, 16, 1),
  ('Moxies - Nashville', 'MOX24005', 'TN', 'MJ', 'TFO', '', '2025-09-02', '2025-10-15', '2025-10-23', 12000, 109, 1),
  ('Denali Development - Abilene, TX', 'SRA25006', 'TX', 'MJ', 'Ground up', '', '2025-12-24', '2026-01-28', '2026-02-27', 40000, 364, 1),
  ('Piada - Richardson', 'PIA26001', 'TX', 'MJ', 'TFO', '', '2026-02-25', '2026-03-18', '2026-03-25', 2000, 18, 1),
  ('Church''s Texas Chicken - Goulds, FL', 'CTC25004', 'TX', 'EM', 'TFO', '', '2025-09-17', '2025-10-08', '2025-10-15', 5000, 45, 0),
  ('State & Main Kitchen Bar - Mckinney TX', 'SAM25001', 'TX', 'SAS/MJ', 'TFO', '', '2025-08-27', '2025-09-15', '2025-09-15', 7500, 68, 0.5),
  ('Barrio Taco - Mckinney', 'BAT24001', 'TX', 'SAS', 'TFO', '', '2025-08-27', '2025-09-15', '2025-09-15', 5000, 45, 0),
  ('Einstein Bagels Lavon, TX', 'EBB25011', 'TX', 'MJ', 'TFO', '', '2025-09-22', '2025-10-03', '2025-10-14', 2500, 23, 0.5),
  ('BoomerJack Tomball, TX', 'BMJ25001', 'TX', 'MJ', 'Ground up', '', '2025-11-14', '2025-12-12', '2025-12-12', 14000, 127, 4),
  ('Hideaway - Frisco, TX', 'HAP25001', 'TX', 'MJ/EM', 'Ground up', '', '2025-09-24', '2025-10-03', '2025-10-07', 2000, 18, 0.5),
  ('Rustic - Colony TX (LAVA Cantana -remodel)', 'FRC25001', 'TX', 'SAS', 'Conversion', '', '2025-11-13', '2026-01-16', '2026-01-23', 5800, 53, 1),
  ('Church''s Texas Chicken - Albany, GA', 'CTC24017', 'GA', 'SAS', 'Site Adapt', '', '2025-11-07', '2025-12-18', '2026-01-05', 2400, 22, 0.5),
  ('Dave''s Hot Chicken - Cedar Hill - TX', 'DHC25023', 'TX', 'SAS', 'TFO', '', '2026-01-30', '2026-02-27', '2026-03-06', 2000, 18, 0.5),
  ('Urban Egg - Patio Addition - Johnstown - CO', 'UEE26001', 'CO', 'SAS', 'Patio Addition', '', '2026-02-02', '2026-02-11', '2026-02-12', 4800, 44, 0.5),
  ('Urban Egg - Coppel - TX', 'UEE25002', 'TX', 'EM', 'TFO', '', '2026-02-02', '2026-03-02', '2026-03-09', 2000, 18, 0.5),
  ('Church''s Texas Chicken - Miami FL', 'CTC25008', 'FL', 'SAS', 'Site Adapt - Modification', '', '2026-02-03', '2026-03-03', '2026-03-10', 5000, 45, 0.5),
  ('Urban Egg - Mansfield - TX', 'UEE25004', 'TX', 'SAS', 'Tenant Finish out', '', '2026-02-10', '2026-03-10', '2026-03-17', 5000, 45, 14.5),
  ('Urban Egg - Austin - TX', 'UEE25001', 'TX', 'EM', 'Tenant Finish out', '', '2026-02-19', '2026-03-19', '2026-03-26', 3000, 27, 1);
