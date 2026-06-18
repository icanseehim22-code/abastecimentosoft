-- Adiciona a coluna posto na tabela abastecimentos
alter table public.abastecimentos add column if not exists posto text;

-- Remove a view antiga para evitar erro de redefinição de ordem de colunas
drop view if exists public.vw_abastecimentos cascade;

-- Recria a view vw_abastecimentos incluindo a coluna posto
create or replace view public.vw_abastecimentos
with (security_invoker = on) as
select
  a.id, a.data, a.veiculo_id, v.nome as veiculo_nome, v.placa,
  a.motorista_id, coalesce(m.nome, a.motorista_nome) as motorista,
  a.combustivel, a.km, a.litros, a.valor, a.preco_litro,
  a.posto, -- coluna adicionada
  a.autorizado_por, a.observacao, a.origem, a.created_at
from public.abastecimentos a
join public.veiculos v   on v.id = a.veiculo_id
left join public.motoristas m on m.id = a.motorista_id;
