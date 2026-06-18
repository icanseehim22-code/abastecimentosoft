-- 1. Cria a tabela de postos
create table if not exists public.postos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cnpj text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Insere os postos já cadastrados de forma orgânica na tabela de postos
insert into public.postos (nome)
select distinct posto
from public.abastecimentos
where posto is not null and posto <> ''
on conflict (nome) do nothing;

-- 3. Adiciona a coluna posto_id na tabela de abastecimentos
alter table public.abastecimentos add column if not exists posto_id uuid references public.postos(id) on delete restrict;

-- 4. Associa os abastecimentos existentes aos postos recém-criados
update public.abastecimentos a
set posto_id = p.id
from public.postos p
where p.nome = a.posto;

-- 5. Habilita RLS na nova tabela
alter table public.postos enable row level security;

-- 6. Adiciona políticas RLS para postos (Leitura: todos autenticados | Escrita: gestor/admin)
drop policy if exists postos_sel on public.postos;
create policy postos_sel on public.postos for select to authenticated using (true);

drop policy if exists postos_wr on public.postos;
create policy postos_wr on public.postos for all to authenticated
  using (public.eh_gestor())
  with check (public.eh_gestor());

-- 7. Recria a view vw_abastecimentos para trazer o nome do posto associado
-- Mantém coalesce(p.nome, a.posto) para resiliência de registros antigos/bot externo
drop view if exists public.vw_abastecimentos cascade;

create or replace view public.vw_abastecimentos
with (security_invoker = on) as
select
  a.id, a.data, a.veiculo_id, v.nome as veiculo_nome, v.placa,
  a.motorista_id, coalesce(m.nome, a.motorista_nome) as motorista,
  a.combustivel, a.km, a.litros, a.valor, a.preco_litro,
  coalesce(p.nome, a.posto) as posto,
  a.posto_id,
  a.autorizado_por, a.observacao, a.origem, a.created_at
from public.abastecimentos a
join public.veiculos v   on v.id = a.veiculo_id
left join public.motoristas m on m.id = a.motorista_id
left join public.postos p on p.id = a.posto_id;
