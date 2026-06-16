# Sistema de Gestão de Abastecimento

Sistema web completo de gestão de abastecimento da frota, com **Supabase** (Postgres) como
fonte única de dados, **bot do Telegram** como canal de registro no campo e **disparo
automático de relatórios** (Telegram / Email / WhatsApp).

## Estrutura

```
GestaoAbastecimento/
├── app/                      # Painel web (React + Vite + TS + Tailwind)
│   ├── src/
│   │   ├── auth/             # AuthContext (Supabase Auth)
│   │   ├── components/       # Layout, ProtectedRoute, Placeholder
│   │   ├── lib/supabase.ts   # cliente Supabase
│   │   ├── pages/            # telas (Login + seções)
│   │   └── types.ts          # tipos do domínio
│   └── .env.local            # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
└── supabase/
    └── migrations/           # 0001 schema · 0002 views · 0003 anomalias · 0004 RLS · 0005 seed
```

O **bot** continua em `C:\ControleAbastecimento\` (será repontado para o Supabase na Fase 2).
O script de migração do histórico do Excel está em
`C:\ControleAbastecimento\scripts\migrar_excel_supabase.py`.

## Banco de dados (Supabase)

Tabelas: `profiles`, `veiculos`, `motoristas`, `abastecimentos`, `metas`, `alertas`, `config`.
Views: `vw_abastecimentos`, `vw_eficiencia` (km/l e R$/km tanque-a-tanque), `vw_resumo_mensal`.
Anomalias: trigger `trg_anomalias` + função `fn_scan_consumo`.

### Aplicar as migrações
1. Crie um projeto em https://supabase.com (anote URL, anon key e service_role key).
2. No SQL Editor do Supabase, rode os arquivos de `supabase/migrations/` na ordem (0001 → 0005),
   **ou** via CLI: `npx supabase link` + `npx supabase db push`.

## App web

```bash
cd app
npm install        # já instalado
# preencha .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev        # http://localhost:5173
```

## Status das fases
- [x] Fase 0 — Fundação: SQL do banco, scaffold web, script de migração
- [ ] Fase 1 — Auth + CRUD (abastecimentos, veículos, motoristas)
- [ ] Fase 2 — Bot → Supabase
- [ ] Fase 3 — Dashboards + Eficiência
- [ ] Fase 4 — Custos, Metas e Anomalias
- [ ] Fase 5 — Relatórios + Disparo (Telegram/Email/WhatsApp)
- [ ] Fase 6 — Acabamento + deploy (Vercel)
