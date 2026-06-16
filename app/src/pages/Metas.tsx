import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Target, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  useMetas, useUpsertMeta, useDeleteMeta, useAbastecimentos, useVeiculos, useMotoristas,
} from '../lib/queries'
import type { Meta } from '../types'
import { fmtBRL, fmtNum } from '../lib/format'
import { ymKey, ymLabel, ymAtual, ymShift, soma } from '../lib/analytics'
import Modal from '../components/ui/Modal'
import { Field, Input, Select, btn } from '../components/ui/fields'
import { motion } from 'framer-motion'

function novaMeta(ano: number, mes: number): Partial<Meta> {
  return { escopo: 'global', ref_id: null, ano, mes, limite_valor: null, limite_litros: null }
}

function Barra({ atual, limite }: { atual: number; limite: number | null }) {
  if (!limite) return <span className="text-xs text-slate-400 dark:text-slate-500">sem meta</span>
  const pct = Math.min((atual / limite) * 100, 100)
  const real = (atual / limite) * 100
  const cor = real > 100 ? 'bg-red-500 dark:bg-red-500' : real > 80 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-950">
        <div className={`h-full ${cor} rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {fmtNum(real, 0)}% {real > 100 && <span className="font-semibold text-red-600 dark:text-red-400">• estourou</span>}
      </div>
    </div>
  )
}

export default function Metas() {
  const [ym, setYm] = useState(ymAtual())
  const [ano, mes] = ym.split('-').map(Number)
  const { data: metas = [] } = useMetas(ano, mes)
  const { data: abast = [] } = useAbastecimentos({})
  const { data: veiculos = [] } = useVeiculos(true)
  const { data: motoristas = [] } = useMotoristas(true)
  const upsert = useUpsertMeta()
  const del = useDeleteMeta()
  const [edit, setEdit] = useState<Partial<Meta> | null>(null)

  const nomeVei = useMemo(() => new Map(veiculos.map((v) => [v.id, `${v.nome} — ${v.placa}`])), [veiculos])
  const nomeMot = useMemo(() => new Map(motoristas.map((m) => [m.id, m.nome])), [motoristas])
  const mesAbast = useMemo(() => abast.filter((a) => ymKey(a.data) === ym), [abast, ym])

  function realizado(m: Meta) {
    let rows = mesAbast
    if (m.escopo === 'veiculo') rows = rows.filter((a) => a.veiculo_id === m.ref_id)
    else if (m.escopo === 'motorista') rows = rows.filter((a) => a.motorista_id === m.ref_id)
    return { valor: soma(rows, (a) => a.valor), litros: soma(rows, (a) => a.litros) }
  }

  function rotulo(m: Meta) {
    if (m.escopo === 'global') return 'Geral (toda a frota)'
    if (m.escopo === 'veiculo') return nomeVei.get(m.ref_id ?? '') ?? 'Veículo'
    return nomeMot.get(m.ref_id ?? '') ?? 'Motorista'
  }

  async function salvar() {
    if (!edit) return
    if (!edit.limite_valor && !edit.limite_litros) return
    await upsert.mutateAsync({
      ...edit,
      ref_id: edit.escopo === 'global' ? null : edit.ref_id,
      limite_valor: edit.limite_valor ? Number(edit.limite_valor) : null,
      limite_litros: edit.limite_litros ? Number(edit.limite_litros) : null,
    })
    setEdit(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Custos & Metas</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md">
            <button className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-300" onClick={() => setYm(ymShift(ym, -1))}><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-20 text-center text-sm font-medium capitalize text-slate-800 dark:text-slate-200">{ymLabel(ym)}</span>
            <button className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-300" onClick={() => setYm(ymShift(ym, 1))}><ChevronRight className="h-4 w-4" /></button>
          </div>
          <button className={btn()} onClick={() => setEdit(novaMeta(ano, mes))}><Plus className="h-4 w-4" /> Nova meta</button>
        </div>
      </div>

      {metas.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500">
          <Target className="h-10 w-10 text-slate-500" />
          <p className="text-sm">Nenhuma meta definida para {ymLabel(ym)}.</p>
          <button className={btn('ghost')} onClick={() => setEdit(novaMeta(ano, mes))}>Definir meta</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {metas.map((m) => {
            const r = realizado(m)
            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800/80 dark:bg-slate-900/60 dark:backdrop-blur-md shadow-sm hover:shadow-md transition"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">{rotulo(m)}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">{m.escopo}</p>
                  </div>
                  <div className="flex gap-1">
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200" onClick={() => setEdit(m)}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400" onClick={() => { if (confirm('Excluir esta meta?')) del.mutate(m.id) }}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Meta financeira</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{fmtBRL(r.valor)} {m.limite_valor && <span className="text-slate-400">/ {fmtBRL(m.limite_valor)}</span>}</span>
                    </div>
                    <Barra atual={r.valor} limite={m.limite_valor} />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Meta de volume</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{fmtNum(r.litros)} L {m.limite_litros && <span className="text-slate-400">/ {fmtNum(m.limite_litros, 0)} L</span>}</span>
                    </div>
                    <Barra atual={r.litros} limite={m.limite_litros} />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <Modal open={!!edit} title={edit?.id ? 'Editar meta' : 'Definir limite mensal'} onClose={() => setEdit(null)}>
        {edit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Escopo da meta">
                <Select value={edit.escopo ?? 'global'} onChange={(e) => setEdit({ ...edit, escopo: e.target.value as Meta['escopo'], ref_id: null })}>
                  <option value="global">Geral (Toda frota)</option>
                  <option value="veiculo">Por Veículo</option>
                  <option value="motorista">Por Motorista</option>
                </Select>
              </Field>
              {edit.escopo === 'veiculo' && (
                <Field label="Selecione o veículo">
                  <Select value={edit.ref_id ?? ''} onChange={(e) => setEdit({ ...edit, ref_id: e.target.value })}>
                    <option value="">Selecione…</option>
                    {veiculos.map((v) => <option key={v.id} value={v.id}>{v.nome} ({v.placa})</option>)}
                  </Select>
                </Field>
              )}
              {edit.escopo === 'motorista' && (
                <Field label="Selecione o motorista">
                  <Select value={edit.ref_id ?? ''} onChange={(e) => setEdit({ ...edit, ref_id: e.target.value })}>
                    <option value="">Selecione…</option>
                    {motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </Select>
                </Field>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Limite financeiro (R$)">
                <Input type="number" step="0.01" value={edit.limite_valor ?? ''} onChange={(e) => setEdit({ ...edit, limite_valor: e.target.value ? Number(e.target.value) : null })} placeholder="Ex.: 1500" />
              </Field>
              <Field label="Limite de volume (Litros)">
                <Input type="number" step="1" value={edit.limite_litros ?? ''} onChange={(e) => setEdit({ ...edit, limite_litros: e.target.value ? Number(e.target.value) : null })} placeholder="Ex.: 300" />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className={btn('ghost')} onClick={() => setEdit(null)}>Cancelar</button>
              <button className={btn()} onClick={salvar} disabled={upsert.isPending || (!edit.limite_valor && !edit.limite_litros) || (edit.escopo !== 'global' && !edit.ref_id)}>
                {upsert.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  )
}
