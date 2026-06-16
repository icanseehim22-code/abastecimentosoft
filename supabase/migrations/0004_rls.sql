-- ============================================================================
-- 0004_rls.sql — Row Level Security e políticas de acesso
-- Regra geral: leitura p/ autenticados; escrita p/ gestor/admin.
-- Operadores podem inserir abastecimentos. service_role (bot) ignora RLS.
-- ============================================================================

-- ── Helpers de papel ────────────────────────────────────────────────────────
create or replace function public.meu_papel()
returns text language sql stable security definer set search_path = public as $$
  select papel::text from public.profiles where id = auth.uid();
$$;

create or replace function public.eh_gestor()
returns boolean language sql stable set search_path = public as $$
  select coalesce(public.meu_papel() in ('admin','gestor'), false);
$$;

-- ── Habilita RLS ────────────────────────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.veiculos       enable row level security;
alter table public.motoristas     enable row level security;
alter table public.abastecimentos enable row level security;
alter table public.metas          enable row level security;
alter table public.alertas        enable row level security;
alter table public.config         enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────
drop policy if exists profiles_sel on public.profiles;
create policy profiles_sel on public.profiles for select to authenticated using (true);

drop policy if exists profiles_upd_own on public.profiles;
create policy profiles_upd_own on public.profiles for update to authenticated
  using (id = auth.uid() or public.eh_gestor())
  with check (id = auth.uid() or public.eh_gestor());

-- ── veiculos / motoristas / metas / config: leitura todos, escrita gestor ───
do $$
declare t text;
begin
  foreach t in array array['veiculos','motoristas','metas','config'] loop
    execute format('drop policy if exists %1$s_sel on public.%1$s;', t);
    execute format('create policy %1$s_sel on public.%1$s for select to authenticated using (true);', t);
    execute format('drop policy if exists %1$s_wr on public.%1$s;', t);
    execute format('create policy %1$s_wr on public.%1$s for all to authenticated using (public.eh_gestor()) with check (public.eh_gestor());', t);
  end loop;
end $$;

-- ── abastecimentos: leitura todos; inserir autenticado; editar/excluir gestor ─
drop policy if exists abast_sel on public.abastecimentos;
create policy abast_sel on public.abastecimentos for select to authenticated using (true);

drop policy if exists abast_ins on public.abastecimentos;
create policy abast_ins on public.abastecimentos for insert to authenticated with check (true);

drop policy if exists abast_upd on public.abastecimentos;
create policy abast_upd on public.abastecimentos for update to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());

drop policy if exists abast_del on public.abastecimentos;
create policy abast_del on public.abastecimentos for delete to authenticated
  using (public.eh_gestor());

-- ── alertas: leitura todos; atualizar (resolver) gestor ─────────────────────
drop policy if exists alertas_sel on public.alertas;
create policy alertas_sel on public.alertas for select to authenticated using (true);

drop policy if exists alertas_upd on public.alertas;
create policy alertas_upd on public.alertas for update to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
