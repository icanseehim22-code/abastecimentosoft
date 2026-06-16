-- ============================================================================
-- 0002_views.sql — Views de análise (eficiência, resumo mensal)
-- security_invoker=on para que a RLS das tabelas-base seja aplicada ao usuário.
-- ============================================================================

-- ── Abastecimentos enriquecidos ─────────────────────────────────────────────
create or replace view public.vw_abastecimentos
with (security_invoker = on) as
select
  a.id, a.data, a.veiculo_id, v.nome as veiculo_nome, v.placa,
  a.motorista_id, coalesce(m.nome, a.motorista_nome) as motorista,
  a.combustivel, a.km, a.litros, a.valor, a.preco_litro,
  a.autorizado_por, a.observacao, a.origem, a.created_at
from public.abastecimentos a
join public.veiculos v   on v.id = a.veiculo_id
left join public.motoristas m on m.id = a.motorista_id;

-- ── Eficiência tanque-a-tanque (km/l, R$/km por intervalo) ──────────────────
-- km_rodado  = km atual - km do abastecimento anterior do MESMO veículo
-- km_por_litro = km_rodado / litros do abastecimento atual (tanque cheio)
create or replace view public.vw_eficiencia
with (security_invoker = on) as
with ord as (
  select
    a.id, a.veiculo_id, a.data, a.km, a.litros, a.valor, a.combustivel, a.created_at,
    lag(a.km) over (partition by a.veiculo_id order by a.data, a.km, a.created_at) as km_anterior
  from public.abastecimentos a
  where a.km is not null
)
select
  o.id, o.veiculo_id, o.data, o.km, o.km_anterior, o.litros, o.valor, o.combustivel,
  (o.km - o.km_anterior) as km_rodado,
  case when o.km_anterior is not null and (o.km - o.km_anterior) > 0 and o.litros > 0
       then round((o.km - o.km_anterior) / o.litros, 2) end as km_por_litro,
  case when o.km_anterior is not null and (o.km - o.km_anterior) > 0
       then round(o.valor / nullif(o.km - o.km_anterior, 0), 4) end as rs_por_km
from ord o;

-- ── Resumo mensal por veículo ───────────────────────────────────────────────
create or replace view public.vw_resumo_mensal
with (security_invoker = on) as
select
  e.veiculo_id,
  extract(year  from e.data)::int as ano,
  extract(month from e.data)::int as mes,
  count(*)                                         as abastecimentos,
  sum(e.litros)                                    as litros,
  sum(e.valor)                                     as valor,
  sum(case when e.km_rodado > 0 then e.km_rodado else 0 end) as km_rodado,
  round(
    sum(case when e.km_por_litro is not null then e.km_rodado else 0 end) /
    nullif(sum(case when e.km_por_litro is not null then e.litros else 0 end), 0)
  , 2)                                             as km_por_litro_medio
from public.vw_eficiencia e
group by e.veiculo_id, ano, mes;
