-- Cria a tabela de quantidade de OS (Ordens de Serviço) por veículo e período
create table if not exists public.veiculo_os (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  quantidade integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(veiculo_id, periodo_inicio, periodo_fim)
);

-- Habilita Row Level Security (RLS)
alter table public.veiculo_os enable row level security;

-- Políticas de Acesso
drop policy if exists veiculo_os_sel on public.veiculo_os;
create policy veiculo_os_sel on public.veiculo_os for select to authenticated using (true);

drop policy if exists veiculo_os_all on public.veiculo_os;
create policy veiculo_os_all on public.veiculo_os for all to authenticated using (true) with check (true);
