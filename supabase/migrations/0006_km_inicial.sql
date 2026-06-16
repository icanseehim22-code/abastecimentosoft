-- Adiciona coluna de KM inicial em veiculos
alter table public.veiculos add column if not exists km_inicial integer;

-- Recria a view vw_eficiencia utilizando coalesce(lag(km), km_inicial)
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
  v.km_inicial,
  coalesce(o.km_anterior, v.km_inicial) as km_anterior_efetivo,
  (o.km - coalesce(o.km_anterior, v.km_inicial)) as km_rodado,
  case when coalesce(o.km_anterior, v.km_inicial) is not null 
            and (o.km - coalesce(o.km_anterior, v.km_inicial)) > 0 
            and o.litros > 0
       then round((o.km - coalesce(o.km_anterior, v.km_inicial)) / o.litros, 2) end as km_por_litro,
  case when coalesce(o.km_anterior, v.km_inicial) is not null 
            and (o.km - coalesce(o.km_anterior, v.km_inicial)) > 0
       then round(o.valor / nullif(o.km - coalesce(o.km_anterior, v.km_inicial), 0), 4) end as rs_por_km
from ord o
join public.veiculos v on v.id = o.veiculo_id;
