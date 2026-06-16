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

function novaMeta(ano: number, mes: number): Partial<Meta> {
  return { escopo: 'global', ref_id: null, ano, mes, limite_valor: null, limite_litros: null }
}

function Barra({ atual, limite }: { atual: number; limite: number | null }) {
  if (!limite) return <span className="text-xs text-slate-400">sem meta</span>
  const pct = Math.min((atual / limite) * 100, 100)
  const real = (atual / limite) * 100
  const cor = real > 100 ? 'bg-red-500' : real > 80 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {fmtNum(real, 0)}% {real > 100 && <span className="font-semibold text-red-600">• estourou</span>}
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
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Custos & Metas</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1">
            <button className="rounded p-1 hover:bg-slate-100" onClick={() => setYm(ymShift(ym, -1))}><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-20 text-center text-sm font-medium capitalize">{ymLabel(ym)}</span>
            <button className="rounded p-1 hover:bg-slate-100" onClick={() => setYm(ymShift(ym, 1))}><ChevronRight className="h-4 w-4" /></button>
          </div>
          <button className={btn()} onClick={() => setEdit(novaMeta(ano, mes))}><Plus className="h-4 w-4" /> Nova meta</button>
        </div>
      </div>

      {metas.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-slate-400">
          <Target className="h-10 w-10" />
          <p className="text-sm">Nenhuma meta definida para {ymLabel(ym)}.</p>
          <button className={btn('ghost')} onClick={() => setEdit(novaMeta(ano, mes))}>Definir meta</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {metas.map((m) => {
            const r = realizado(m)
            return (
              <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="text-xs uppercase text-slate-400">{m.escopo}</div>
                    <div className="font-semibold text-slate-800">{rotulo(m)}</div>
                  </div>
                  <div className="flex gap-1">
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setEdit(m)}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => { if (confirm('Excluir esta meta?')) del.mutate(m.id) }}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-sm"><span className="text-slate-500">Valor</span><span className="font-medium">{fmtBRL(r.valor)} {m.limite_valor && <span className="text-slate-400">/ {fmtBRL(m.limite_valor)}</span>}</span></div>
                    <Barra atual={r.valor} limite={m.limite_valor} />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-sm"><span className="text-slate-500">Litros</span><span className="font-medium">{fmtNum(r.litros)} L {m.limite_litros && <span className="text-slate-400">/ {fmtNum(m.limite_litros, 0)} L</span>}</span></div>
                    <Barra atual={r.litros} limite={m.limite_litros} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={!!edit} title={edit?.id ? 'Editar meta' : 'Nova meta'} onClose={() => setEdit(null)}>
        {edit && (
          <div className="space-y-4">
            <div className="text-sm text-slate-500">Mês de referência: <b className="capitalize">{ymLabel(`${edit.ano}-${String(edit.mes).padStart(2, '0')}`)}</b></div>
            <Field label="Escopo">
              <Select value={edit.escopo} onChange={(e) => setEdit({ ...edit, escopo: e.target.value as Meta['escopo'], ref_id: null })}>
                <option value="global">Geral (toda a frota)</option>
                <option value="veiculo">Por veículo</option>
                <option value="motorista">Por motorista</option>
              </Select>
            </Field>
            {edit.escopo === 'veiculo' && (
              <Field label="Veículo">
                <Select value={edit.ref_id ?? ''} onChange={(e) => setEdit({ ...edit, ref_id: e.target.value || null })}>
                  <option value="">Selecione…</option>
                  {veiculos.map((v) => <option key={v.id} value={v.id}>{v.nome} — {v.placa}</option>)}
                </Select>
              </Field>
            )}
            {edit.escopo === 'motorista' && (
              <Field label="Motorista">
                <Select value={edit.ref_id ?? ''} onChange={(e) => setEdit({ ...edit, ref_id: e.target.value || null })}>
                  <option value="">Selecione…</option>
                  {motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </Select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Limite de gasto (R$)">
                <Input type="number" step="0.01" value={edit.limite_valor ?? ''} onChange={(e) => setEdit({ ...edit, limite_valor: e.target.value ? Number(e.target.value) : null })} />
              </Field>
              <Field label="Limite de litros">
                <Input type="number" step="1" value={edit.limite_litros ?? ''} onChange={(e) => setEdit({ ...edit, limite_litros: e.target.value ? Number(e.target.value) : null })} />
              </Field>
            </div>
            <p className="text-xs text-slate-400">Preencha pelo menos um dos limites.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button className={btn('ghost')} onClick={() => setEdit(null)}>Cancelar</button>
              <button className={btn()} onClick={salvar} disabled={upsert.isPending || (!edit.limite_valor && !edit.limite_litros) || (edit.escopo !== 'global' && !edit.ref_id)}>
                {upsert.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
