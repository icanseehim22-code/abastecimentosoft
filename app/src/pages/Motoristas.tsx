import { useState } from 'react'
import { Plus, Pencil, User } from 'lucide-react'
import { useMotoristas, useUpsertMotorista } from '../lib/queries'
import type { Motorista } from '../types'
import Modal from '../components/ui/Modal'
import { Field, Input, btn } from '../components/ui/fields'

const vazio: Partial<Motorista> = { nome: '', telefone: '', ativo: true }

export default function Motoristas() {
  const { data: motoristas = [], isLoading } = useMotoristas(true)
  const upsert = useUpsertMotorista()
  const [edit, setEdit] = useState<Partial<Motorista> | null>(null)

  async function salvar() {
    if (!edit?.nome) return
    await upsert.mutateAsync({ ...edit, nome: edit.nome.trim() })
    setEdit(null)
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Motoristas</h1>
        <button className={btn()} onClick={() => setEdit({ ...vazio })}>
          <Plus className="h-4 w-4" /> Novo motorista
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Carregando…</td></tr>
            )}
            {!isLoading && motoristas.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Nenhum motorista cadastrado.</td></tr>
            )}
            {motoristas.map((m) => (
              <tr key={m.id} className={m.ativo ? '' : 'opacity-50'}>
                <td className="px-4 py-3 font-medium text-slate-800">
                  <span className="inline-flex items-center gap-2"><User className="h-4 w-4 text-slate-400" />{m.nome}</span>
                </td>
                <td className="px-4 py-3">{m.telefone || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {m.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setEdit(m)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!edit} title={edit?.id ? 'Editar motorista' : 'Novo motorista'} onClose={() => setEdit(null)}>
        {edit && (
          <div className="space-y-4">
            <Field label="Nome">
              <Input value={edit.nome ?? ''} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
            </Field>
            <Field label="Telefone">
              <Input value={edit.telefone ?? ''} onChange={(e) => setEdit({ ...edit, telefone: e.target.value })} placeholder="(64) 9....." />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={edit.ativo ?? true} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} />
              Ativo
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button className={btn('ghost')} onClick={() => setEdit(null)}>Cancelar</button>
              <button className={btn()} onClick={salvar} disabled={upsert.isPending || !edit.nome}>
                {upsert.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
