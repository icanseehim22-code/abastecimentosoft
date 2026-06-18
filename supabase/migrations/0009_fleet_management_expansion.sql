-- ── 1. TABELA DE REGRAS DE MANUTENÇÃO PREVENTIVA ──────────────────────────────
create table if not exists public.regras_manutencao (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id) on delete cascade,
  nome text not null, -- Ex: 'Troca de Óleo', 'Rodízio de Pneus', 'Filtro'
  intervalo_km integer not null, -- Ex: 10000
  ultimo_realizado_km integer not null, -- O KM em que foi realizada pela última vez
  created_at timestamptz not null default now()
);

-- Ativar RLS
alter table public.regras_manutencao enable row level security;

-- Políticas
drop policy if exists rm_sel on public.regras_manutencao;
create policy rm_sel on public.regras_manutencao for select to authenticated using (true);

drop policy if exists rm_wr on public.regras_manutencao;
create policy rm_wr on public.regras_manutencao for all to authenticated
  using (public.eh_gestor())
  with check (public.eh_gestor());


-- ── 2. ATUALIZAÇÃO DO MOTOR DE ANOMALIAS (ANTIFRAUDE) ──────────────────
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
  v_km_rodado  integer;
  v_kml        numeric;
begin
  -- Remove alertas antigos do mesmo abastecimento (caso de UPDATE)
  delete from public.alertas where abastecimento_id = new.id;

  -- Configurações globais
  select valor into cfg from public.config where chave = 'limites';
  lim_litros := coalesce((cfg->>'litros')::numeric, 300);
  lim_valor  := coalesce((cfg->>'valor')::numeric, 2000);

  select capacidade_tanque into v_cap from public.veiculos where id = new.veiculo_id;

  -- 1) KM regressivo (odômetro menor que o último abastecimento)
  select max(km) into v_ultimo_km
    from public.abastecimentos
   where veiculo_id = new.veiculo_id and id <> new.id and km is not null
     and (data < new.data or (data = new.data and created_at < new.created_at));
  if new.km is not null and v_ultimo_km is not null and new.km < v_ultimo_km then
    insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
    values (new.id, new.veiculo_id, 'km_regressivo', 'alta',
            format('Odômetro regressivo: KM informado (%s) é menor que o último registrado (%s).', new.km, v_ultimo_km));
  end if;

  -- 2) Litragem suspeita (litros abastecidos > capacidade do tanque físico do veículo)
  if v_cap is not null and new.litros > v_cap then
    insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
    values (new.id, new.veiculo_id, 'litros_acima_tanque', 'alta',
            format('Litragem incompatível: Abastecidos %s L em tanque com capacidade máxima de %s L.', new.litros, v_cap));
  elsif new.litros > lim_litros then
    insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
    values (new.id, new.veiculo_id, 'litros_acima_limite', 'media',
            format('Litros (%s) acima do limite corporativo (%s L).', new.litros, lim_litros));
  end if;

  -- 3) Valor total acima do limite global
  if new.valor > lim_valor then
    insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
    values (new.id, new.veiculo_id, 'valor_acima_limite', 'media',
            format('Custo total (R$ %s) acima do limite corporativo (R$ %s).', new.valor, lim_valor));
  end if;

  -- 4) Preço do litro fora da faixa (por combustível)
  select valor into faixa from public.config where chave = 'faixa_preco';
  if faixa is not null and new.preco_litro is not null then
    pmin := (faixa -> new.combustivel ->> 'min')::numeric;
    pmax := (faixa -> new.combustivel ->> 'max')::numeric;
    if pmin is not null and new.preco_litro < pmin then
      insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
      values (new.id, new.veiculo_id, 'preco_baixo', 'media',
              format('Preço/L (R$ %s) abaixo da faixa para %s (mín R$ %s).', new.preco_litro, new.combustivel, pmin));
    end if;
    if pmax is not null and new.preco_litro > pmax then
      insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
      values (new.id, new.veiculo_id, 'preco_alto', 'media',
              format('Preço/L (R$ %s) acima da faixa para %s (max R$ %s).', new.preco_litro, new.combustivel, pmax));
    end if;
  end if;

  -- 5) Duplicidade: múltiplos abastecimentos do mesmo veículo no mesmo dia
  if exists (
    select 1 from public.abastecimentos
     where veiculo_id = new.veiculo_id and data = new.data and id <> new.id
  ) then
    insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
    values (new.id, new.veiculo_id, 'duplicidade_dia', 'baixa',
            'Mais de um abastecimento do mesmo veículo registrado neste dia.');
  end if;

  -- 6) CONSUMO IMPOSSÍVEL (MÉDIA FORA DE PARÂMETROS FÍSICOS - ALERTA ALTO)
  if new.km is not null and v_ultimo_km is not null and new.litros > 0 then
    v_km_rodado := new.km - v_ultimo_km;
    if v_km_rodado > 0 then
      v_kml := v_km_rodado / new.litros;
      if v_kml < 3.0 or v_kml > 35.0 then
        insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
        values (new.id, new.veiculo_id, 'consumo_impossivel', 'alta',
                format('Média de consumo impossível de %s km/l calculada (KM percorrido: %s, Litros: %s). Suspeita de desvio ou erro grave de digitação.',
                       round(v_kml, 2), v_km_rodado, new.litros));
      end if;
    end if;
  end if;

  -- 7) DUPLICIDADE DE TEMPO (ABASTECIMENTOS DUPLOS EM MENOS DE 2 HORAS - ALERTA ALTO)
  if exists (
    select 1 from public.abastecimentos
     where veiculo_id = new.veiculo_id
       and data = new.data
       and id <> new.id
       and abs(extract(epoch from (created_at - new.created_at))) < 7200
  ) then
    insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
    values (new.id, new.veiculo_id, 'duplicidade_tempo_curto', 'alta',
            'Abastecimentos duplicados em curto intervalo de tempo (menos de 2 horas) para o mesmo veículo.');
  end if;

  -- 8) GAP DE QUILOMETRAGEM (KM ESQUECIDA / ABASTECIMENTO SEM REGISTRO - ALERTA MÉDIO)
  if new.km is not null and v_ultimo_km is not null then
    v_km_rodado := new.km - v_ultimo_km;
    if v_km_rodado > 1500 then
      insert into public.alertas (abastecimento_id, veiculo_id, tipo, severidade, mensagem)
      values (new.id, new.veiculo_id, 'gap_odometro', 'media',
              format('Grande lacuna de quilometragem (%s km) desde o último abastecimento. Possível abastecimento não lançado.', v_km_rodado));
    end if;
  end if;

  return new;
end $$;
