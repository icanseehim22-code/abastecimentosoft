import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LabelList,
} from 'recharts'
import { Building2, TrendingUp, TrendingDown, Fuel } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAbastecimentos, type FiltrosAbast } from '../lib/queries'
import { fmtBRL, fmtNum } from '../lib/format'
import { Input } from '../components/ui/fields'
import { useChartTheme, ChartTooltip, CHART_COLORS, tickBRLk } from '../components/ui/charts'

/** Paleta para diferenciar os postos nos gráficos. */
const CORES = CHART_COLORS

const ROTULO_SEM_POSTO = 'Não informado'

interface ResumoPosto {
  posto: string
  registros: number
  litros: number
  valor: number
  precoMedio: number // R$/L médio (valor / litros)
  pctValor: number
}

export default function AnalisePostos() {
  const [filtros, setFiltros] = useState<FiltrosAbast>({})
  const { data: lista = [], isLoading } = useAbastecimentos(filtros)
  const ct = useChartTheme()

  const { resumo, totalValor } = useMemo(() => {
    const mapa = new Map<string, ResumoPosto>()
    for (const r of lista) {
      const chave = r.posto?.trim() || ROTULO_SEM_POSTO
      const atual = mapa.get(chave) ?? {
        posto: chave, registros: 0, litros: 0, valor: 0, precoMedio: 0, pctValor: 0,
      }
      atual.registros += 1
      atual.litros += Number(r.litros || 0)
      atual.valor += Number(r.valor || 0)
      mapa.set(chave, atual)
    }
    const total = [...mapa.values()].reduce((s, p) => s + p.valor, 0)
    const resumo = [...mapa.values()]
      .map((p) => ({
        ...p,
        precoMedio: p.litros > 0 ? p.valor / p.litros : 0,
        pctValor: total > 0 ? (p.valor / total) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor)
    return { resumo, totalValor: total }
  }, [lista])

  // Postos reais (ignora "Não informado") para destacar o mais caro/barato por R$/L
  const comPreco = resumo.filter((p) => p.posto !== ROTULO_SEM_POSTO && p.litros > 0)
  const maisCaro = comPreco.length
    ? comPreco.reduce((a, b) => (b.precoMedio > a.precoMedio ? b : a))
    : null
  const maisBarato = comPreco.length
    ? comPreco.reduce((a, b) => (b.precoMedio < a.precoMedio ? b : a))
    : null
  const maisUsado = resumo.length
    ? resumo.reduce((a, b) => (b.registros > a.registros ? b : a))
    : null

  // Comparativo de preço médio (R$/L) — só postos reais, do mais barato ao mais caro
  const precoData = [...comPreco]
    .map((p) => ({ posto: p.posto, precoMedio: Number(p.precoMedio.toFixed(3)) }))
    .sort((a, b) => a.precoMedio - b.precoMedio)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Análise de Posto</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">Período:</span>
          <Input type="date" value={filtros.inicio ?? ''} onChange={(e) => setFiltros({ ...filtros, inicio: e.target.value || undefined })} />
          <span className="text-slate-400">→</span>
          <Input type="date" value={filtros.fim ?? ''} onChange={(e) => setFiltros({ ...filtros, fim: e.target.value || undefined })} />
        </div>
      </div>

      {/* Cards de destaque */}
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <CardDestaque
          icon={<Building2 className="h-5 w-5" />}
          titulo="Posto mais usado"
          valor={maisUsado ? maisUsado.posto : '—'}
          sub={maisUsado ? `${maisUsado.registros} abastecimentos` : ''}
          cor="text-blue-600 dark:text-blue-400"
        />
        <CardDestaque
          icon={<TrendingDown className="h-5 w-5" />}
          titulo="Menor R$/L médio"
          valor={maisBarato ? maisBarato.posto : '—'}
          sub={maisBarato ? `${fmtBRL(maisBarato.precoMedio)} / litro` : ''}
          cor="text-emerald-600 dark:text-emerald-400"
        />
        <CardDestaque
          icon={<TrendingUp className="h-5 w-5" />}
          titulo="Maior R$/L médio"
          valor={maisCaro ? maisCaro.posto : '—'}
          sub={maisCaro ? `${fmtBRL(maisCaro.precoMedio)} / litro` : ''}
          cor="text-rose-600 dark:text-rose-400"
        />
      </div>

      {/* Gráficos */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Gasto por posto</h2>
          {resumo.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <Fuel className="mx-auto mb-2 h-8 w-8" />
              {isLoading ? 'Carregando…' : 'Nenhum abastecimento no período.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, resumo.length * 46)}>
              <BarChart data={resumo} layout="vertical" margin={{ left: 12, right: 56 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} tickFormatter={tickBRLk} />
                <YAxis type="category" dataKey="posto" width={130} tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} />
                <Tooltip cursor={ct.cursor} content={<ChartTooltip hideLabel formatter={(v) => fmtBRL(v)} />} />
                <Bar dataKey="valor" radius={[0, 6, 6, 0]} name="Gasto" maxBarSize={28}>
                  {resumo.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                  <LabelList dataKey="valor" position="right" formatter={(v: any) => fmtBRL(Number(v))} style={{ fontSize: 11, fill: ct.axis, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Preço médio (R$/L) por posto</h2>
          {precoData.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <Fuel className="mx-auto mb-2 h-8 w-8" />
              {isLoading ? 'Carregando…' : 'Sem preço médio para comparar.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, precoData.length * 46)}>
              <BarChart data={precoData} layout="vertical" margin={{ left: 12, right: 64 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtBRL(v)} domain={[0, 'auto']} />
                <YAxis type="category" dataKey="posto" width={130} tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} />
                <Tooltip cursor={ct.cursor} content={<ChartTooltip hideLabel formatter={(v) => `${fmtBRL(v)} / L`} />} />
                <Bar dataKey="precoMedio" radius={[0, 6, 6, 0]} name="R$/L" maxBarSize={28}>
                  {precoData.map((p, i) => (
                    <Cell key={i} fill={p.posto === maisBarato?.posto ? '#16a34a' : p.posto === maisCaro?.posto ? '#ef4444' : CORES[i % CORES.length]} />
                  ))}
                  <LabelList dataKey="precoMedio" position="right" formatter={(v: any) => fmtBRL(Number(v))} style={{ fontSize: 11, fill: ct.axis, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabela comparativa */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Posto</th>
              <th className="px-4 py-3 text-right">Abastecimentos</th>
              <th className="px-4 py-3 text-right">Litros</th>
              <th className="px-4 py-3 text-right">Gasto total</th>
              <th className="px-4 py-3 text-right">R$/L médio</th>
              <th className="px-4 py-3 text-right">% do gasto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {resumo.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                {isLoading ? 'Carregando…' : 'Nenhum dado para analisar.'}
              </td></tr>
            )}
            {resumo.map((p, i) => (
              <tr key={p.posto} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CORES[i % CORES.length] }} />
                    {p.posto}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{p.registros}</td>
                <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{fmtNum(p.litros)} L</td>
                <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-200">{fmtBRL(p.valor)}</td>
                <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{p.precoMedio > 0 ? fmtBRL(p.precoMedio) : '—'}</td>
                <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">{fmtNum(p.pctValor, 1)}%</td>
              </tr>
            ))}
          </tbody>
          {resumo.length > 0 && (
            <tfoot className="border-t border-slate-200 dark:border-slate-800 text-sm font-semibold">
              <tr>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200">Total</td>
                <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{resumo.reduce((s, p) => s + p.registros, 0)}</td>
                <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{fmtNum(resumo.reduce((s, p) => s + p.litros, 0))} L</td>
                <td className="px-4 py-3 text-right text-slate-800 dark:text-slate-100">{fmtBRL(totalValor)}</td>
                <td className="px-4 py-3 text-right text-slate-400">—</td>
                <td className="px-4 py-3 text-right text-slate-400">100%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </motion.div>
  )
}

function CardDestaque({ icon, titulo, valor, sub, cor }: {
  icon: React.ReactNode; titulo: string; valor: string; sub: string; cor: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</span>
        <span className={cor}>{icon}</span>
      </div>
      <div className="truncate text-lg font-bold text-slate-800 dark:text-slate-100" title={valor}>{valor}</div>
      <div className="text-xs text-slate-400 dark:text-slate-500">{sub}</div>
    </div>
  )
}
