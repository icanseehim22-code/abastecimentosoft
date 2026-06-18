import { useMemo, useState } from 'react'
import { Plus, Pencil, Car, Wrench, Check, Trash2 } from 'lucide-react'
import {
  useVeiculos, useUpsertVeiculo, useRegrasManutencao,
  useUpsertRegraManutencao, useDeleteRegraManutencao, useAbastecimentos
} from '../lib/queries'
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
  const [error, setError] = useState<string | null>(null)

  // Estados do gerenciador de manutenção
  const [manutencaoVeiculo, setManutencaoVeiculo] = useState<Veiculo | null>(null)
  const [regrasError, setRegrasError] = useState<string | null>(null)
  const [novaRegraNome, setNovaRegraNome] = useState('')
  const [novaRegraIntervalo, setNovaRegraIntervalo] = useState<number | ''>('')
  const [novaRegraUltimoKm, setNovaRegraUltimoKm] = useState<number | ''>('')

  function handleSetEdit(v: Partial<Veiculo> | null) {
    setError(null)
    setEdit(v)
  }

  function handleSetManutencaoVeiculo(v: Veiculo | null) {
    setRegrasError(null)
    setManutencaoVeiculo(v)
  }

  // Queries de regras de manutenção e abastecimentos
  const { data: todasRegras = [] } = useRegrasManutencao()
  const { data: abastecimentos = [] } = useAbastecimentos({})
  const { data: regras = [] } = useRegrasManutencao(manutencaoVeiculo?.id)
  const upsertRegra = useUpsertRegraManutencao()
  const deleteRegra = useDeleteRegraManutencao()

  // Mapeia o KM atual de cada veículo
  const latestKmMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of abastecimentos) {
      const vId = r.veiculo_id
      if (r.km && (!map[vId] || r.km > map[vId])) {
        map[vId] = r.km
      }
    }
    return map
  }, [abastecimentos])

  // Identifica o status de manutenção (se há itens vencidos ou próximos)
  const statusManutencaoMap = useMemo(() => {
    const map: Record<string, 'vencido' | 'proximo' | 'ok'> = {}
    for (const r of todasRegras) {
      const vId = r.veiculo_id
      const v = veiculos.find((x) => x.id === vId)
      const currentKm = latestKmMap[vId] ?? v?.km_inicial ?? 0
      const restante = (r.ultimo_realizado_km + r.intervalo_km) - currentKm

      if (restante <= 0) {
        map[vId] = 'vencido' // Vermelho tem prioridade
      } else if (restante <= 500 && map[vId] !== 'vencido') {
        map[vId] = 'proximo' // Amarelo
      } else if (!map[vId]) {
        map[vId] = 'ok'
      }
    }
    return map
  }, [todasRegras, latestKmMap, veiculos])

  async function salvar() {
    if (!edit?.nome || !edit?.placa) return
    setError(null)
    try {
      await upsert.mutateAsync({
        ...edit,
        placa: edit.placa.trim().toUpperCase(),
        capacidade_tanque: edit.capacidade_tanque ? Number(edit.capacidade_tanque) : null,
        km_inicial: edit.km_inicial ? Number(edit.km_inicial) : null,
      })
      handleSetEdit(null)
    } catch (err: any) {
      setError(err.message || String(err))
    }
  }

  const currentKm = manutencaoVeiculo
    ? latestKmMap[manutencaoVeiculo.id] ?? manutencaoVeiculo.km_inicial ?? 0
    : 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Veículos</h1>
          <button className={btn()} onClick={() => handleSetEdit({ ...vazio })}>
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
              <th className="px-4 py-3 text-right">KM Atual</th>
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
            {veiculos.map((v) => {
              const statusM = statusManutencaoMap[v.id]
              const currentVeiculoKm = latestKmMap[v.id] ?? v.km_inicial ?? 0
              return (
                <tr key={v.id} className={`${v.ativo ? '' : 'opacity-50'} hover:bg-slate-50/40 dark:hover:bg-slate-800/20`}>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                    <span className="inline-flex items-center gap-2">
                      <Car className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      {v.nome}
                      {statusM === 'vencido' && (
                        <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xxs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 animate-pulse">
                          <Wrench className="h-3 w-3" /> Manut. Vencida
                        </span>
                      )}
                      {statusM === 'proximo' && (
                        <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xxs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                          <Wrench className="h-3 w-3" /> Manut. Próxima
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{v.placa}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{v.combustivel_padrao || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{v.capacidade_tanque ? fmtNum(v.capacidade_tanque, 0) : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{currentVeiculoKm ? fmtNum(currentVeiculoKm, 0) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.ativo ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {v.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
                        onClick={() => handleSetManutencaoVeiculo(v)}
                        title="Gerenciar Manutenções"
                      >
                        <Wrench className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
                        onClick={() => handleSetEdit(v)}
                        title="Editar veículo"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL DE EDIÇÃO / CADASTRO DE VEÍCULO */}
      <Modal open={!!edit} title={edit?.id ? 'Editar veículo' : 'Novo veículo'} onClose={() => handleSetEdit(null)}>
        {edit && (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-red-600 font-semibold border border-red-200">
                {error}
              </div>
            )}
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
              <button className={btn('ghost')} onClick={() => handleSetEdit(null)}>Cancelar</button>
              <button className={btn()} onClick={salvar} disabled={upsert.isPending || !edit.nome || !edit.placa}>
                {upsert.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL DE GERENCIAR MANUTENÇÕES PREVENTIVAS */}
      <Modal
        open={!!manutencaoVeiculo}
        title={manutencaoVeiculo ? `Manutenções Preventivas — ${manutencaoVeiculo.nome}` : ''}
        onClose={() => handleSetManutencaoVeiculo(null)}
      >
        {manutencaoVeiculo && (
          <div className="space-y-5">
            {regrasError && (
              <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-red-600 font-semibold border border-red-200">
                {regrasError}
              </div>
            )}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <div className="text-xs text-slate-400 uppercase font-semibold">Odômetro Atual</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{fmtNum(currentKm, 0)} km</div>
              </div>
              <div className="text-xs text-slate-400 text-right">
                Baseado nos abastecimentos.<br/>
                KM Inicial: {fmtNum(manutencaoVeiculo.km_inicial ?? 0, 0)} km
              </div>
            </div>

            {/* Listagem de Regras */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Serviços Programados</h3>
              {regras.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-sm">
                  Nenhum serviço programado para este veículo.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {regras.map((r) => {
                    const proximaKm = r.ultimo_realizado_km + r.intervalo_km
                    const restante = proximaKm - currentKm
                    const isVencido = restante <= 0
                    const isProximo = restante <= 500

                    return (
                      <div key={r.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex justify-between items-center shadow-sm">
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            {r.nome}
                            {isVencido ? (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xxs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">Vencida</span>
                            ) : isProximo ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xxs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Próxima</span>
                            ) : (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xxs font-bold text-green-700 dark:bg-green-950/40 dark:text-green-400">Em dia</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            A cada {fmtNum(r.intervalo_km, 0)} km • Feito com: {fmtNum(r.ultimo_realizado_km, 0)} km • Próximo: {fmtNum(proximaKm, 0)} km
                          </div>
                          <div className={`text-xs font-bold ${isVencido ? 'text-rose-600' : isProximo ? 'text-amber-600' : 'text-slate-400'}`}>
                            {isVencido ? `Atrasado em ${fmtNum(Math.abs(restante), 0)} km` : `Restam ${fmtNum(restante, 0)} km`}
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <button
                            onClick={async () => {
                              setRegrasError(null)
                              try {
                                await upsertRegra.mutateAsync({ ...r, ultimo_realizado_km: currentKm })
                              } catch (err: any) {
                                setRegrasError(err.message || String(err))
                              }
                            }}
                            disabled={upsertRegra.isPending}
                            className="rounded-lg p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 transition"
                            title="Marcar Concluído / Resetar KM"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={async () => {
                              setRegrasError(null)
                              try {
                                await deleteRegra.mutateAsync(r.id)
                              } catch (err: any) {
                                setRegrasError(err.message || String(err))
                              }
                            }}
                            disabled={deleteRegra.isPending}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Programar Novo Serviço */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Programar Novo Serviço</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome do Serviço">
                  <Input value={novaRegraNome} onChange={(e) => setNovaRegraNome(e.target.value)} placeholder="Ex: Troca de Óleo" />
                </Field>
                <Field label="Intervalo (KM)">
                  <Input type="number" value={novaRegraIntervalo} onChange={(e) => setNovaRegraIntervalo(e.target.value ? Number(e.target.value) : '')} placeholder="Ex: 10000" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <Field label="KM da Última Realização">
                  <Input type="number" value={novaRegraUltimoKm} onChange={(e) => setNovaRegraUltimoKm(e.target.value ? Number(e.target.value) : '')} placeholder={`Default: ${currentKm}`} />
                </Field>
                <button
                  onClick={async () => {
                    if (!novaRegraNome || !novaRegraIntervalo || !manutencaoVeiculo) return
                    setRegrasError(null)
                    try {
                      await upsertRegra.mutateAsync({
                        veiculo_id: manutencaoVeiculo.id,
                        nome: novaRegraNome,
                        intervalo_km: Number(novaRegraIntervalo),
                        ultimo_realizado_km: Number(novaRegraUltimoKm || currentKm)
                      })
                      setNovaRegraNome('')
                      setNovaRegraIntervalo('')
                      setNovaRegraUltimoKm('')
                    } catch (err: any) {
                      setRegrasError(err.message || String(err))
                    }
                  }}
                  disabled={upsertRegra.isPending || !novaRegraNome || !novaRegraIntervalo}
                  className={`${btn()} w-full py-2.5`}
                >
                  Programar Serviço
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  )
}
