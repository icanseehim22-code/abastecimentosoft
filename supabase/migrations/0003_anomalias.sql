-- ============================================================================
-- 0003_anomalias.sql — Motor de detecção de anomalias
-- Trigger SECURITY DEFINER em abastecimentos grava em public.alertas.
-- ============================================================================

create or replace function public.tg_detectar_anomalias()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_cap        numeric;
  v_ultimo_km  integer;
  cfg          jsonb;
  faixa        jsonb;
  lim_litros   numeric;
  lim_valor    numeric;
  pmin         numeric;
  pmax         numeric;
begin
  -- Reprocessa: remove alertas anteriores deste registro (caso de UPDATE)
  delete from public.alertas where abastecimento_id = new.id;

  -- Config de limites globais (fallback p/ defaults do bot)
  select valor into cfg from public.config where chave = 'limites';
  lim_litros := coalesce((cfg->>'litros')::numeric, 300);
  lim_valor  := coalesce((cfg->>'valor')::numeric, 2000);

  select capacidade_tanque into v_cap from public.veiculos where id = new.veiculo_id;

  -- 1) KM regressivo (menor que o último do veículo)
  select max(km) into v_ultimo_km
    from public.abastecimentos
   where veiculo_id = new.veiculo_id and id <> new.id and km is not null
     and (data < new.data or (data = new.data and created_at < new.created_at));
  if new.km is not null and v_ultimo_km is not null and new.km < v_ultimo_km then
    insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
    values (new.id, new.veiculo_id, 'km_regressivo', 'alta',
            format('KM informado (%s) menor que o último registrado (%s).', new.km, v_ultimo_km));
  end if;

  -- 2) Litros acima da capacidade do tanque / limite global
  if v_cap is not null and new.litros > v_cap then
    insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
    values (new.id, new.veiculo_id, 'litros_acima_tanque', 'alta',
            format('Litros (%s) acima da capacidade do tanque (%s L).', new.litros, v_cap));
  elsif new.litros > lim_litros then
    insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
    values (new.id, new.veiculo_id, 'litros_acima_limite', 'media',
            format('Litros (%s) acima do limite (%s L).', new.litros, lim_litros));
  end if;

  -- 3) Valor acima do limite global
  if new.valor > lim_valor then
    insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
    values (new.id, new.veiculo_id, 'valor_acima_limite', 'media',
            format('Valor (R$ %s) acima do limite (R$ %s).', new.valor, lim_valor));
  end if;

  -- 4) Preço por litro fora da faixa configurada (por combustível)
  select valor into faixa from public.config where chave = 'faixa_preco';
  if faixa is not null and new.preco_litro is not null then
    pmin := (faixa -> new.combustivel ->> 'min')::numeric;
    pmax := (faixa -> new.combustivel ->> 'max')::numeric;
    if pmin is not null and new.preco_litro < pmin then
      insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
      values (new.id, new.veiculo_id, 'preco_baixo', 'media',
              format('Preço/litro (R$ %s) abaixo da faixa de %s (min R$ %s).', new.preco_litro, new.combustivel, pmin));
    end if;
    if pmax is not null and new.preco_litro > pmax then
      insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
      values (new.id, new.veiculo_id, 'preco_alto', 'media',
              format('Preço/litro (R$ %s) acima da faixa de %s (max R$ %s).', new.preco_litro, new.combustivel, pmax));
    end if;
  end if;

  -- 5) Duplicidade: outro abastecimento do mesmo veículo no mesmo dia
  if exists (
    select 1 from public.abastecimentos
     where veiculo_id = new.veiculo_id and data = new.data and id <> new.id
  ) then
    insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
    values (new.id, new.veiculo_id, 'duplicidade_dia', 'baixa',
            'Mais de um abastecimento do mesmo veículo neste dia.');
  end if;

  return new;
end $$;

drop trigger if exists trg_anomalias on public.abastecimentos;
create trigger trg_anomalias
  after insert or update of km, litros, valor, combustivel, data on public.abastecimentos
  for each row execute function public.tg_detectar_anomalias();

-- ── Scan estatístico de consumo (km/l fora da média do veículo) ─────────────
-- Chamável sob demanda / por cron. Gera alertas 'consumo_anormal'.
create or replace function public.fn_scan_consumo(p_desvio numeric default 0.30)
returns integer
language plpgsql
security definer
set search_path = public as $$
declare
  r       record;
  n       integer := 0;
begin
  for r in
    with med as (
      select veiculo_id, avg(km_por_litro) as media
        from public.vw_eficiencia
       where km_por_litro is not null
       group by veiculo_id
      having count(*) >= 5
    )
    select e.id, e.veiculo_id, e.km_por_litro, m.media
      from public.vw_eficiencia e
      join med m on m.veiculo_id = e.veiculo_id
     where e.km_por_litro is not null
       and abs(e.km_por_litro - m.media) > m.media * p_desvio
  loop
    if not exists (select 1 from public.alertas
                    where abastecimento_id = r.id and tipo = 'consumo_anormal') then
      insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
      values (r.id, r.veiculo_id, 'consumo_anormal', 'media',
              format('Consumo %s km/l fora da média do veículo (%s km/l).',
                     round(r.km_por_litro,2), round(r.media,2)));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
