import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, BarChart, CartesianGrid, Cell, LabelList,
  PieChart, Pie, Legend, Area, AreaChart,
} from 'recharts'
import { DollarSign, Fuel, Route, Gauge, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAbastecimentos, useEficiencia } from '../lib/queries'
import { fmtBRL, fmtNum } from '../lib/format'
import { ymKey, ymLabel, ymAtual, ymShift, ultimosMeses, soma } from '../lib/analytics'
import KpiCard from '../components/ui/KpiCard'
import { useChartTheme, ChartTooltip, CHART_COLORS, tickBRLk } from '../components/ui/charts'
import { motion } from 'framer-motion'

const PALETA = CHART_COLORS

export default function Dashboard() {
  const { data: abast = [], isLoading } = useAbastecimentos({})
  const { data: efi = [] } = useEficiencia()
  const [ym, setYm] = useState(ymAtual())
  const ct = useChartTheme()

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
      const valor = soma(reg, (a) => a.valor)
      const litros = soma(reg, (a) => a.litros)
      return { mes: ymLabel(m), valor, litros, precoMedio: litros > 0 ? valor / litros : null }
    })
  }, [abast])

  const porVeiculo = useMemo(() => {
    const mes = abast.filter((a) => ymKey(a.data) === ym)
    const map = new Map<string, number>()
    for (const a of mes) map.set(a.veiculo_nome, (map.get(a.veiculo_nome) || 0) + Number(a.valor || 0))
    return [...map.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)
  }, [abast, ym])

  const porCombustivel = useMemo(() => {
    const mes = abast.filter((a) => ymKey(a.data) === ym)
    const map = new Map<string, number>()
    for (const a of mes) map.set(a.combustivel, (map.get(a.combustivel) || 0) + Number(a.valor || 0))
    return [...map.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)
  }, [abast, ym])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md">
          <button className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-300" onClick={() => setYm(ymShift(ym, -1))}><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-20 text-center text-sm font-medium capitalize text-slate-800 dark:text-slate-200">{ymLabel(ym)}</span>
          <button className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-300 disabled:opacity-30" disabled={ym >= ymAtual()} onClick={() => setYm(ymShift(ym, 1))}><ChevronRight className="h-4 w-4" /></button>
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
                  <defs>
                    <linearGradient id="grad-gasto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b62f0" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#3b62f0" stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="l" tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} tickFormatter={tickBRLk} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}L`} />
                  <Tooltip
                    cursor={ct.cursor}
                    content={<ChartTooltip formatter={(v, n) => (n === 'Gasto' ? fmtBRL(v) : `${fmtNum(v)} L`)} />}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  <Bar yAxisId="l" dataKey="valor" fill="url(#grad-gasto)" radius={[6, 6, 0, 0]} name="Gasto" maxBarSize={38} />
                  <Line yAxisId="r" dataKey="litros" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: '#f59e0b' }} activeDot={{ r: 5 }} name="Litros" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800/80 dark:bg-slate-900/60 dark:backdrop-blur-md">
              <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Gasto por veículo — {ymLabel(ym)}</h2>
              {porVeiculo.length === 0 ? (
                <div className="py-20 text-center text-sm text-slate-400 dark:text-slate-500">Sem dados no mês.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={porVeiculo} layout="vertical" margin={{ left: 20, right: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} tickFormatter={tickBRLk} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: ct.axis }} width={90} axisLine={false} tickLine={false} />
                    <Tooltip cursor={ct.cursor} content={<ChartTooltip hideLabel formatter={(v) => fmtBRL(v)} />} />
                    <Bar dataKey="valor" radius={[0, 6, 6, 0]} maxBarSize={26}>
                      {porVeiculo.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
                      <LabelList dataKey="valor" position="right" formatter={(v: any) => fmtBRL(Number(v))} style={{ fontSize: 11, fill: ct.axis, fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800/80 dark:bg-slate-900/60 dark:backdrop-blur-md">
              <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Gasto por combustível — {ymLabel(ym)}</h2>
              {porCombustivel.length === 0 ? (
                <div className="py-20 text-center text-sm text-slate-400 dark:text-slate-500">Sem dados no mês.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={porCombustivel} dataKey="valor" nameKey="nome" cx="50%" cy="50%"
                      innerRadius={58} outerRadius={92} paddingAngle={3} stroke="none">
                      {porCombustivel.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip hideLabel formatter={(v, n) => `${n}: ${fmtBRL(v)}`} />} />
                    <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800/80 dark:bg-slate-900/60 dark:backdrop-blur-md">
              <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Preço médio do litro — últimos 12 meses</h2>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={serieMensal} margin={{ left: -6, right: 8 }}>
                  <defs>
                    <linearGradient id="grad-preco" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtBRL(v)} width={70} domain={['auto', 'auto']} />
                  <Tooltip cursor={ct.cursorLine} content={<ChartTooltip formatter={(v) => `${fmtBRL(v)} / L`} />} />
                  <Area type="monotone" dataKey="precoMedio" stroke="#16a34a" strokeWidth={2.5} fill="url(#grad-preco)" connectNulls dot={{ r: 3, fill: '#16a34a' }} activeDot={{ r: 5 }} name="R$/L" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}
