import { useState } from 'react'
import { AlertTriangle, Check, RotateCcw, ShieldCheck, ScanLine } from 'lucide-react'
import { useAlertas, useResolverAlerta } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { fmtBRL, fmtNum, fmtDataBR } from '../lib/format'
import { motion, AnimatePresence } from 'framer-motion'

const TIPO_LABEL: Record<string, string> = {
  km_regressivo: 'KM regressivo',
  litros_acima_tanque: 'Litros acima do tanque',
  litros_acima_limite: 'Litros acima do limite',
  valor_acima_limite: 'Valor acima do limite',
  preco_baixo: 'Preço/litro baixo',
  preco_alto: 'Preço/litro alto',
  duplicidade_dia: 'Duplicidade no dia',
  consumo_anormal: 'Consumo anormal',
}

const SEV: Record<string, string> = {
  alta: 'border-red-200 bg-red-50 text-red-700 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-400',
  media: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-950/40 dark:bg-amber-950/20 dark:text-amber-400',
  baixa: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400',
}

export default function Alertas() {
  const [soNaoResolvidos, setSoNaoResolvidos] = useState(true)
  const { data: alertas = [], isLoading, refetch } = useAlertas(soNaoResolvidos)
  const resolver = useResolverAlerta()
  const [scaneando, setScaneando] = useState(false)
  const [msgScan, setMsgScan] = useState<string | null>(null)

  async function rodarScan() {
    setScaneando(true)
    setMsgScan(null)
    const { data, error } = await supabase.rpc('fn_scan_consumo', { p_desvio: 0.3 })
    setScaneando(false)
    setMsgScan(error ? `Erro: ${error.message}` : `Scan concluído: ${data ?? 0} novo(s) alerta(s) de consumo.`)
    refetch()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Alertas</h1>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            onClick={rodarScan}
            disabled={scaneando}
          >
            <ScanLine className="h-4 w-4" /> {scaneando ? 'Verificando…' : 'Verificar consumo'}
          </button>
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={soNaoResolvidos}
              onChange={(e) => setSoNaoResolvidos(e.target.checked)}
              className="accent-brand-600 rounded"
            />
            Só não resolvidos
          </label>
        </div>
      </div>

      {msgScan && (
        <div className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-950/20 dark:text-brand-400">
          {msgScan}
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center text-slate-400 dark:text-slate-500">Carregando…</div>
      ) : alertas.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500">
          <ShieldCheck className="h-10 w-10 text-green-500" />
          <p className="text-sm">Nenhum alerta {soNaoResolvidos ? 'pendente' : ''}. Tudo certo! 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {alertas.map((a) => (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`flex items-start gap-3 rounded-2xl border bg-white p-4 transition-all duration-200 dark:bg-slate-900/60 dark:border-slate-800/80 dark:backdrop-blur-md ${
                  a.resolvido ? 'opacity-50' : ''
                }`}
              >
                <div className={`mt-0.5 rounded-lg border p-2 ${SEV[a.severidade]}`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-850 dark:text-slate-100">{TIPO_LABEL[a.tipo] ?? a.tipo}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${SEV[a.severidade]}`}>{a.severidade}</span>
                    {a.resolvido && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-400">
                        resolvido
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.mensagem}</p>
                  <div className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                    {a.veiculo && <span>🚗 {a.veiculo.nome} ({a.veiculo.placa}) · </span>}
                    {a.abastecimento && (
                      <span>
                        {fmtDataBR(a.abastecimento.data)} · {fmtNum(a.abastecimento.litros)} L · {fmtBRL(a.abastecimento.valor)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                  onClick={() => resolver.mutate({ id: a.id, resolvido: !a.resolvido })}
                >
                  {a.resolvido ? (
                    <>
                      <RotateCcw className="mr-1 inline h-3 w-3" /> Reabrir
                    </>
                  ) : (
                    <>
                      <Check className="mr-1 inline h-3 w-3" /> Resolver
                    </>
                  )}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}
