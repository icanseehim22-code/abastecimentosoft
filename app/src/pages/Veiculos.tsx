import { useState } from 'react'
import { Plus, Pencil, Car } from 'lucide-react'
import { useVeiculos, useUpsertVeiculo } from '../lib/queries'
import type { Veiculo } from '../types'
import { fmtNum, COMBUSTIVEIS } from '../lib/format'
import Modal from '../components/ui/Modal'
import { Field, Input, Select, btn } from '../components/ui/fields'

const vazio: Partial<Veiculo> = { nome: '', placa: '', combustivel_padrao: '', capacidade_tanque: null, ativo: true }

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
    })
    setEdit(null)
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Veículos</h1>
        <button className={btn()} onClick={() => setEdit({ ...vazio })}>
          <Plus className="h-4 w-4" /> Novo veículo
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Combustível</th>
              <th className="px-4 py-3 text-right">Tanque (L)</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Carregando…</td></tr>
            )}
            {!isLoading && veiculos.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhum veículo.</td></tr>
            )}
            {veiculos.map((v) => (
              <tr key={v.id} className={v.ativo ? '' : 'opacity-50'}>
                <td className="px-4 py-3 font-medium text-slate-800">
                  <span className="inline-flex items-center gap-2"><Car className="h-4 w-4 text-slate-400" />{v.nome}</span>
                </td>
                <td className="px-4 py-3">{v.placa}</td>
                <td className="px-4 py-3">{v.combustivel_padrao || '—'}</td>
                <td className="px-4 py-3 text-right">{v.capacidade_tanque ? fmtNum(v.capacidade_tanque, 0) : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {v.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setEdit(v)}>
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
            <Field label="Nome / Identificação">
              <Input value={edit.nome ?? ''} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="Ex.: MOBI 01" />
            </Field>
            <Field label="Placa">
              <Input value={edit.placa ?? ''} onChange={(e) => setEdit({ ...edit, placa: e.target.value })} placeholder="ABC-1234" />
            </Field>
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
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={edit.ativo ?? true} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} />
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
    </div>
  )
}
