import { useMemo, useState } from 'react'
import { Plus, Pencil, Building2, TrendingDown } from 'lucide-react'
import { usePostos, useUpsertPosto, useAbastecimentos } from '../lib/queries'
import type { Posto } from '../types'
import Modal from '../components/ui/Modal'
import { Field, Input, btn } from '../components/ui/fields'
import { motion } from 'framer-motion'
import { fmtBRL } from '../lib/format'

const vazio: Partial<Posto> = { nome: '', cnpj: '', ativo: true }

export default function Postos() {
  const { data: postos = [], isLoading } = usePostos(true)
  const upsert = useUpsertPosto()
  const [edit, setEdit] = useState<Partial<Posto> | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Carrega os últimos abastecimentos para calcular as médias de preços
  const { data: abastecimentos = [] } = useAbastecimentos({})

  function handleSetEdit(p: Partial<Posto> | null) {
    setError(null)
    setEdit(p)
  }

  async function salvar() {
    if (!edit?.nome) return
    setError(null)
    try {
      await upsert.mutateAsync({
        ...edit,
        nome: edit.nome.trim(),
        cnpj: edit.cnpj?.trim() || null
      })
      handleSetEdit(null)
    } catch (err: any) {
      setError(err.message || String(err))
    }
  }

  // Agrupa os abastecimentos por combustível e por posto para calcular a média
  const postosEconomia = useMemo(() => {
    const groups: Record<string, Record<string, { totalValor: number; totalLitros: number; count: number }>> = {}

    for (const r of abastecimentos) {
      if (!r.posto || !r.combustivel || !r.litros || !r.valor) continue
      const postoNome = r.posto.trim()
      const comb = r.combustivel

      if (!groups[comb]) groups[comb] = {}
      if (!groups[comb][postoNome]) {
        groups[comb][postoNome] = { totalValor: 0, totalLitros: 0, count: 0 }
      }

      const g = groups[comb][postoNome]
      g.totalValor += Number(r.valor)
      g.totalLitros += Number(r.litros)
      g.count += 1
    }

    const result: Record<string, { posto: string; precoMedio: number; count: number }[]> = {}
    for (const [comb, postosMap] of Object.entries(groups)) {
      result[comb] = Object.entries(postosMap)
        .map(([posto, data]) => ({
          posto,
          precoMedio: data.totalLitros > 0 ? data.totalValor / data.totalLitros : 0,
          count: data.count
        }))
        .filter(p => p.precoMedio > 0)
        .sort((a, b) => a.precoMedio - b.precoMedio) // O mais barato primeiro
    }

    return result
  }, [abastecimentos])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* SEÇÃO PRINCIPAL: CRUD DE POSTOS */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Postos de Combustível</h1>
            <p className="text-slate-550 dark:text-slate-400 text-sm">Gerencie os postos de combustíveis cadastrados no sistema.</p>
          </div>
          <button className={btn()} onClick={() => handleSetEdit({ ...vazio })}>
            <Plus className="h-4 w-4" /> Novo posto
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md shadow-sm">
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
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.cnpj || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.ativo ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" onClick={() => handleSetEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEÇÃO 2: COMPARATIVO DE PREÇOS (ONDE ABASTECER?) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <TrendingDown className="h-5 w-5 text-emerald-500" />
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Painel Comparativo de Economia</h2>
            <p className="text-xs text-slate-400">Identificação de postos com combustíveis mais baratos no período de lançamentos.</p>
          </div>
        </div>

        {Object.keys(postosEconomia).length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            Sem abastecimentos recentes registrados com postos cadastrados para gerar análise comparativa.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {Object.entries(postosEconomia).map(([comb, ranking]) => {
              const maisBarato = ranking[0]
              const maisCaro = ranking[ranking.length - 1]
              const economia = maisCaro && maisBarato ? maisCaro.precoMedio - maisBarato.precoMedio : 0

              return (
                <div key={comb} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
                    <span>{comb}</span>
                    {economia > 0 && (
                      <span className="text-xxs font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                        Economia: {fmtBRL(economia)}/L
                      </span>
                    )}
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-3 rounded-lg border border-emerald-100/50 dark:border-emerald-900/20">
                      <div className="text-xxs text-emerald-600 dark:text-emerald-400 font-semibold uppercase">Mais Barato</div>
                      <div className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate mt-1">{maisBarato.posto}</div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">{fmtBRL(maisBarato.precoMedio)}/L</div>
                    </div>
                    <div className="bg-rose-50/30 dark:bg-rose-950/10 p-3 rounded-lg border border-rose-100/50 dark:border-rose-900/20">
                      <div className="text-xxs text-rose-600 dark:text-rose-400 font-semibold uppercase">Mais Caro</div>
                      <div className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate mt-1">{maisCaro.posto}</div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">{fmtBRL(maisCaro.precoMedio)}/L</div>
                    </div>
                  </div>

                  {/* Ranking Completo do Combustível */}
                  <div className="space-y-1.5 pt-2">
                    <div className="text-xxs text-slate-400 uppercase font-semibold">Ranking de Postos</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {ranking.map((item, index) => (
                        <div key={item.posto} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 dark:border-slate-800/40">
                          <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                            <span className="font-bold text-slate-400 w-4">{index + 1}º</span>
                            {item.posto}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {fmtBRL(item.precoMedio)}/L
                            <span className="text-xxs text-slate-400 font-normal ml-1">({item.count}x)</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL DE CADASTRO/EDIÇÃO */}
      <Modal open={!!edit} title={edit?.id ? 'Editar posto' : 'Novo posto'} onClose={() => handleSetEdit(null)}>
        {edit && (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-red-600 font-semibold border border-red-200">
                {error}
              </div>
            )}
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
              <button className={btn('ghost')} onClick={() => handleSetEdit(null)}>Cancelar</button>
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
