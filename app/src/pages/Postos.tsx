import { useState } from 'react'
import { Plus, Pencil, Building2 } from 'lucide-react'
import { usePostos, useUpsertPosto } from '../lib/queries'
import type { Posto } from '../types'
import Modal from '../components/ui/Modal'
import { Field, Input, btn } from '../components/ui/fields'
import { motion } from 'framer-motion'

const vazio: Partial<Posto> = { nome: '', cnpj: '', ativo: true }

export default function Postos() {
  const { data: postos = [], isLoading } = usePostos(true)
  const upsert = useUpsertPosto()
  const [edit, setEdit] = useState<Partial<Posto> | null>(null)

  async function salvar() {
    if (!edit?.nome) return
    await upsert.mutateAsync({
      ...edit,
      nome: edit.nome.trim(),
      cnpj: edit.cnpj?.trim() || null
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
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Postos de Combustível</h1>
        <button className={btn()} onClick={() => setEdit({ ...vazio })}>
          <Plus className="h-4 w-4" /> Novo posto
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-left text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">CNPJ</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">Carregando…</td></tr>
            )}
            {!isLoading && postos.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">Nenhum posto cadastrado.</td></tr>
            )}
            {postos.map((p) => (
              <tr key={p.id} className={`${p.ativo ? '' : 'opacity-50'} hover:bg-slate-50/40 dark:hover:bg-slate-800/20`}>
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                  <span className="inline-flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    {p.nome}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-350">{p.cnpj || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.ativo ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {p.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" onClick={() => setEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!edit} title={edit?.id ? 'Editar posto' : 'Novo posto'} onClose={() => setEdit(null)}>
        {edit && (
          <div className="space-y-4">
            <Field label="Nome do Posto">
              <Input value={edit.nome ?? ''} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="Ex: Posto Ipiranga Centro" />
            </Field>
            <Field label="CNPJ (opcional)">
              <Input value={edit.cnpj ?? ''} onChange={(e) => setEdit({ ...edit, cnpj: e.target.value })} placeholder="Ex: 00.000.000/0001-00" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 select-none cursor-pointer">
              <input type="checkbox" checked={edit.ativo ?? true} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} className="rounded accent-brand-600" />
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
    </motion.div>
  )
}
