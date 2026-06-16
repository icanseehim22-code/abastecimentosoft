import { useState } from 'react'
import { Plus, Pencil, Car } from 'lucide-react'
import { useVeiculos, useUpsertVeiculo } from '../lib/queries'
import type { Veiculo } from '../types'
import { fmtNum, COMBUSTIVEIS } from '../lib/format'
import Modal from '../components/ui/Modal'
import { Field, Input, Select, btn } from '../components/ui/fields'
import { motion } from 'framer-motion'

const vazio: Partial<Veiculo> = { nome: '', placa: '', combustivel_padrao: '', capacidade_tanque: null, km_inicial: null, ativo: true }

export default function Veiculos() {
  const { data: veiculos = [], isLoading } = useVeiculos(true)
  const upsert = useUpsertVeiculo()
  const [edit, setEdit] = useState<Partial<Veiculo> | null>(null)

  async function salvar() {
    if (!edit?.nome || !edit?.placa) return
    await upsert.mutateAsync({
      ...edit,
      placa: edit.placa.trim().toUpperCase(),
      capacidade_tanque: edit.capacidade_tanque ? Number(edit.capacidade_tanque) : null,
      km_inicial: edit.km_inicial ? Number(edit.km_inicial) : null,
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
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Veículos</h1>
        <button className={btn()} onClick={() => setEdit({ ...vazio })}>
          <Plus className="h-4 w-4" /> Novo veículo
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-left text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Combustível</th>
              <th className="px-4 py-3 text-right">Tanque (L)</th>
              <th className="px-4 py-3 text-right">KM Inicial</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">Carregando…</td></tr>
            )}
            {!isLoading && veiculos.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">Nenhum veículo.</td></tr>
            )}
            {veiculos.map((v) => (
              <tr key={v.id} className={`${v.ativo ? '' : 'opacity-50'} hover:bg-slate-50/40 dark:hover:bg-slate-800/20`}>
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                  <span className="inline-flex items-center gap-2"><Car className="h-4 w-4 text-slate-400 dark:text-slate-500" />{v.nome}</span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-350">{v.placa}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-350">{v.combustivel_padrao || '—'}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-350">{v.capacidade_tanque ? fmtNum(v.capacidade_tanque, 0) : '—'}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-350">{v.km_inicial ? fmtNum(v.km_inicial, 0) : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.ativo ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {v.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" onClick={() => setEdit(v)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!edit} title={edit?.id ? 'Editar veículo' : 'Novo veículo'} onClose={() => setEdit(null)}>
        {edit && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome / Identificação">
                <Input value={edit.nome ?? ''} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="Ex.: MOBI 01" />
              </Field>
              <Field label="Placa">
                <Input value={edit.placa ?? ''} onChange={(e) => setEdit({ ...edit, placa: e.target.value })} placeholder="ABC-1234" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Combustível padrão">
                <Select value={edit.combustivel_padrao ?? ''} onChange={(e) => setEdit({ ...edit, combustivel_padrao: e.target.value || null })}>
                  <option value="">—</option>
                  {COMBUSTIVEIS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Capacidade do tanque (L)">
                <Input type="number" step="1" value={edit.capacidade_tanque ?? ''} onChange={(e) => setEdit({ ...edit, capacidade_tanque: e.target.value ? Number(e.target.value) : null })} />
              </Field>
            </div>
            <Field label="KM Inicial (Partida)">
              <Input type="number" step="1" value={edit.km_inicial ?? ''} onChange={(e) => setEdit({ ...edit, km_inicial: e.target.value ? Number(e.target.value) : null })} placeholder="Ex.: 45000" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 select-none cursor-pointer">
              <input type="checkbox" checked={edit.ativo ?? true} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} className="rounded accent-brand-600" />
              Ativo
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button className={btn('ghost')} onClick={() => setEdit(null)}>Cancelar</button>
              <button className={btn()} onClick={salvar} disabled={upsert.isPending || !edit.nome || !edit.placa}>
                {upsert.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  )
}
