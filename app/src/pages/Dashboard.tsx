import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, BarChart, CartesianGrid, Cell,
} from 'recharts'
import { DollarSign, Fuel, Route, Gauge, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAbastecimentos, useEficiencia } from '../lib/queries'
import { fmtBRL, fmtNum } from '../lib/format'
import { ymKey, ymLabel, ymAtual, ymShift, ultimosMeses, soma } from '../lib/analytics'
import KpiCard from '../components/ui/KpiCard'
import { useTheme } from '../context/ThemeContext'
import { motion } from 'framer-motion'

const PALETA = ['#3b62f0', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6']

export default function Dashboard() {
  const { data: abast = [], isLoading } = useAbastecimentos({})
  const { data: efi = [] } = useEficiencia()
  const [ym, setYm] = useState(ymAtual())
  const { theme } = useTheme()

  const kpis = useMemo(() => {
    const mes = abast.filter((a) => ymKey(a.data) === ym)
    const mesEfi = efi.filter((e) => ymKey(e.data) === ym)
    const comKmL = mesEfi.filter((e) => e.km_por_litro != null)
    const kmRodado = soma(mesEfi, (e) => (e.km_rodado && e.km_rodado > 0 ? e.km_rodado : 0))
    const gasto = soma(mes, (a) => a.valor)
    const kmLMedio = soma(comKmL, (e) => e.km_rodado || 0) / (soma(comKmL, (e) => e.litros) || 1)
    const gastoAnt = soma(abast.filter((a) => ymKey(a.data) === ymShift(ym, -1)), (a) => a.valor)
    const delta = gastoAnt > 0 ? ((gasto - gastoAnt) / gastoAnt) * 100 : null
    return {
      gasto, litros: soma(mes, (a) => a.litros), n: mes.length, kmRodado,
      kmLMedio: comKmL.length ? kmLMedio : null,
      rsKm: kmRodado > 0 ? soma(comKmL, (e) => e.valor) / (soma(comKmL, (e) => e.km_rodado || 0) || 1) : null,
      delta,
    }
  }, [abast, efi, ym])

  const serieMensal = useMemo(() => {
    const meses = ultimosMeses(12)
    return meses.map((m) => {
      const reg = abast.filter((a) => ymKey(a.data) === m)
      return { mes: ymLabel(m), valor: soma(reg, (a) => a.valor), litros: soma(reg, (a) => a.litros) }
    })
  }, [abast])

  const porVeiculo = useMemo(() => {
    const mes = abast.filter((a) => ymKey(a.data) === ym)
    const map = new Map<string, number>()
    for (const a of mes) map.set(a.veiculo_nome, (map.get(a.veiculo_nome) || 0) + Number(a.valor || 0))
    return [...map.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)
  }, [abast, ym])

  const chartTheme = useMemo(() => {
    const isDark = theme === 'dark'
    return {
      grid: isDark ? '#1e293b' : '#eef2f7',
      text: isDark ? '#94a3b8' : '#64748b',
      tooltip: {
        contentStyle: {
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          borderRadius: '12px',
        },
        itemStyle: { color: isDark ? '#f1f5f9' : '#1e293b' },
        labelStyle: { color: isDark ? '#94a3b8' : '#64748b' }
      }
    }
  }, [theme])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md">
          <button className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-350" onClick={() => setYm(ymShift(ym, -1))}><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-20 text-center text-sm font-medium capitalize text-slate-850 dark:text-slate-200">{ymLabel(ym)}</span>
          <button className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-350 disabled:opacity-30" disabled={ym >= ymAtual()} onClick={() => setYm(ymShift(ym, 1))}><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400 dark:text-slate-500">Carregando…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <KpiCard titulo="Gasto no mês" valor={fmtBRL(kpis.gasto)} icone={DollarSign} cor="brand"
              rodape={kpis.delta == null ? `${kpis.n} abastecimentos`
                : <span className={kpis.delta > 0 ? 'text-red-500 font-semibold' : 'text-green-650 font-semibold'}>{kpis.delta > 0 ? '▲' : '▼'} {fmtNum(Math.abs(kpis.delta), 1)}% vs mês anterior</span>} />
            <KpiCard titulo="Litros no mês" valor={`${fmtNum(kpis.litros)} L`} icone={Fuel} cor="amber" rodape={`${kpis.n} abastecimentos`} />
            <KpiCard titulo="Km rodado" valor={`${fmtNum(kpis.kmRodado, 0)} km`} icone={Route} cor="slate" />
            <KpiCard titulo="Consumo médio" valor={kpis.kmLMedio ? `${fmtNum(kpis.kmLMedio, 1)} km/l` : '—'} icone={Gauge} cor="green" />
            <KpiCard titulo="Custo por km" valor={kpis.rsKm ? fmtBRL(kpis.rsKm) : '—'} icone={TrendingUp} cor="red" />
            <KpiCard titulo="Abastecimentos" valor={String(kpis.n)} icone={Fuel} cor="brand" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800/80 dark:bg-slate-900/60 dark:backdrop-blur-md">
              <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Gasto e litros — últimos 12 meses</h2>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={serieMensal} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: chartTheme.text }} />
                  <YAxis yAxisId="l" tick={{ fontSize: 11, fill: chartTheme.text }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: chartTheme.text }} />
                  <Tooltip
                    contentStyle={chartTheme.tooltip.contentStyle}
                    itemStyle={chartTheme.tooltip.itemStyle}
                    labelStyle={chartTheme.tooltip.labelStyle}
                    formatter={(v, n) => (n === 'valor' ? fmtBRL(Number(v)) : `${fmtNum(Number(v))} L`)}
                  />
                  <Bar yAxisId="l" dataKey="valor" fill="#3b62f0" radius={[4, 4, 0, 0]} name="valor" />
                  <Line yAxisId="r" dataKey="litros" stroke="#f59e0b" strokeWidth={2} dot={false} name="litros" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800/80 dark:bg-slate-900/60 dark:backdrop-blur-md">
              <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Gasto por veículo — {ymLabel(ym)}</h2>
              {porVeiculo.length === 0 ? (
                <div className="py-20 text-center text-sm text-slate-400 dark:text-slate-500">Sem dados no mês.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={porVeiculo} layout="vertical" margin={{ left: 20, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: chartTheme.text }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: chartTheme.text }} width={70} />
                    <Tooltip
                      contentStyle={chartTheme.tooltip.contentStyle}
                      itemStyle={chartTheme.tooltip.itemStyle}
                      labelStyle={chartTheme.tooltip.labelStyle}
                      formatter={(v) => fmtBRL(Number(v))}
                    />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                      {porVeiculo.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}
