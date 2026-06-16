-- ============================================================================
-- 0001_schema.sql — Sistema de Gestão de Abastecimento
-- Tabelas núcleo, enums e triggers utilitários
-- ============================================================================

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type papel_usuario as enum ('admin','gestor','operador');
exception when duplicate_object then null; end $$;

-- ── profiles (1:1 com auth.users) ───────────────────────────────────────────
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  nome             text not null default '',
  papel            papel_usuario not null default 'operador',
  telegram_user_id bigint unique,
  ativo            boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ── veiculos (frota) ────────────────────────────────────────────────────────
create table if not exists public.veiculos (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  placa             text not null unique,
  combustivel_padrao text,
  capacidade_tanque numeric(7,2),
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── motoristas ("nome de quem recebeu") ─────────────────────────────────────
create table if not exists public.motoristas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  telefone   text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists motoristas_nome_uniq on public.motoristas (lower(nome));

-- ── abastecimentos (fato principal) ─────────────────────────────────────────
create table if not exists public.abastecimentos (
  id            uuid primary key default gen_random_uuid(),
  data          date not null,
  veiculo_id    uuid not null references public.veiculos(id) on delete restrict,
  motorista_id  uuid references public.motoristas(id) on delete set null,
  motorista_nome text,                       -- fallback denormalizado p/ histórico
  combustivel   text not null,
  km            integer,
  litros        numeric(8,2)  not null check (litros > 0),
  valor         numeric(10,2) not null check (valor >= 0),
  preco_litro   numeric(10,4) generated always as (round(valor / nullif(litros,0), 4)) stored,
  autorizado_por text,
  observacao    text,
  origem        text not null default 'web' check (origem in ('bot','web')),
  criado_por    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists abast_veiculo_data on public.abastecimentos (veiculo_id, data);
create index if not exists abast_data         on public.abastecimentos (data);
create index if not exists abast_veiculo_km   on public.abastecimentos (veiculo_id, km);

-- ── metas (orçamento mensal por escopo) ─────────────────────────────────────
create table if not exists public.metas (
  id            uuid primary key default gen_random_uuid(),
  escopo        text not null check (escopo in ('veiculo','motorista','global')),
  ref_id        uuid,                         -- veiculo_id / motorista_id / null (global)
  ano           int not null,
  mes           int not null check (mes between 1 and 12),
  limite_litros numeric(10,2),
  limite_valor  numeric(12,2),
  created_at    timestamptz not null default now()
);
create unique index if not exists metas_uniq on public.metas
  (escopo, coalesce(ref_id,'00000000-0000-0000-0000-000000000000'::uuid), ano, mes);

-- ── alertas (anomalias detectadas) ──────────────────────────────────────────
create table if not exists public.alertas (
  id               uuid primary key default gen_random_uuid(),
  abastecimento_id uuid references public.abastecimentos(id) on delete cascade,
  veiculo_id       uuid references public.veiculos(id) on delete cascade,
  tipo             text not null,
  severidade       text not null default 'media' check (severidade in ('baixa','media','alta')),
  mensagem         text not null,
  resolvido        boolean not null default false,
  resolvido_por    uuid references public.profiles(id),
  resolvido_em     timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists alertas_abast        on public.alertas (abastecimento_id);
create index if not exists alertas_naoresolvidos on public.alertas (resolvido) where resolvido = false;

-- ── config (chave/valor jsonb) ──────────────────────────────────────────────
create table if not exists public.config (
  chave      text primary key,
  valor      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── trigger: updated_at automático ──────────────────────────────────────────
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists set_updated_at on public.veiculos;
create trigger set_updated_at before update on public.veiculos
  for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at on public.abastecimentos;
create trigger set_updated_at before update on public.abastecimentos
  for each row execute function public.tg_set_updated_at();

-- ── trigger: cria profile ao criar usuário no Auth ──────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
