-- ============================================================================
-- 0005_seed.sql — Dados iniciais (frota + config)
-- Idempotente: on conflict do nothing.
-- ============================================================================

-- ── Frota (de frota.json) ───────────────────────────────────────────────────
insert into public.veiculos (nome, placa, combustivel_padrao) values
  ('STRADA 2', 'PRZ6G68',  'Gasolina'),
  ('STRADA',   'PRZ-6408', 'Gasolina'),
  ('MOBI 06',  'SDG-5114', 'Etanol'),
  ('MOBI 05',  'SCT8L12',  'Etanol'),
  ('MOBI 04',  'SCU2E62',  'Etanol'),
  ('MOBI 03',  'RCG4D91',  'Etanol'),
  ('MOBI 02',  'RCG4D41',  'Etanol'),
  ('MOBI 01',  'RCG4D81',  'Etanol'),
  ('FIORINO',  'RCK3D73',  'Gasolina'),
  ('Ferrugem', 'Ferrugem', null),
  ('Oseias',   'Oseias',   null),
  ('Vilman',   'Vilman',   null)
on conflict (placa) do nothing;

-- ── Configurações ───────────────────────────────────────────────────────────
insert into public.config (chave, valor) values
  ('limites',      '{"litros": 300, "valor": 2000}'::jsonb),
  ('faixa_preco',  '{"Gasolina": {"min": 4.50, "max": 7.50}, "Etanol": {"min": 3.00, "max": 5.50}, "Diesel": {"min": 4.50, "max": 8.00}}'::jsonb),
  ('destinatarios','{"telegram": ["8725384233"], "emails": [], "whatsapp": []}'::jsonb),
  ('relatorio',    '{"hora": "19:00", "ativo": true}'::jsonb)
on conflict (chave) do nothing;
