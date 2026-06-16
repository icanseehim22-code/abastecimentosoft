import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell,
} from 'recharts'
import { Gauge } from 'lucide-react'
import { useEficiencia, useVeiculos } from '../lib/queries'
import { fmtBRL, fmtNum, fmtDataBR } from '../lib/format'
import { soma } from '../lib/analytics'
import { useTheme } from '../context/ThemeContext'
import { motion } from 'framer-motion'

const PALETA = ['#16a34a', '#3b62f0', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6']

export default function Eficiencia() {
  const { data: efi = [], isLoading } = useEficiencia()
  const { data: veiculos = [] } = useVeiculos(true)
  const [sel, setSel] = useState<string>('')
  const { theme } = useTheme()

  const nomePorId = useMemo(() => {
    const m = new Map<string, string>()
    for (const v of veiculos) m.set(v.id, `${v.nome}`)
    return m
  }, [veiculos])

  const ranking = useMemo(() => {
    const grupos = new Map<string, typeof efi>()
    for (const e of efi) {
      const arr = grupos.get(e.veiculo_id) ?? []
      arr.push(e)
      grupos.set(e.veiculo_id, arr)
    }
    return [...grupos.entries()].map(([id, rows]) => {
      const comKmL = rows.filter((r) => r.km_por_litro != null)
      const kmRodado = soma(rows, (r) => (r.km_rodado && r.km_rodado > 0 ? r.km_rodado : 0))
      const kmL = comKmL.length ? soma(comKmL, (r) => r.km_rodado || 0) / (soma(comKmL, (r) => r.litros) || 1) : null
      const valor = soma(rows, (r) => r.valor)
      const rsKm = kmRodado > 0 ? soma(comKmL, (r) => r.valor) / (soma(comKmL, (r) => r.km_rodado || 0) || 1) : null
      return { id, nome: nomePorId.get(id) ?? id, kmL, rsKm, kmRodado, litros: soma(rows, (r) => r.litros), valor, n: rows.length }
    }).sort((a, b) => (b.kmL ?? -1) - (a.kmL ?? -1))
  }, [efi, nomePorId])

  const serieSel = useMemo(() => {
    if (!sel) return []
    return efi.filter((e) => e.veiculo_id === sel && e.km_por_litro != null)
      .map((e) => ({ data: fmtDataBR(e.data), kmL: e.km_por_litro }))
  }, [efi, sel])

  const chartKmL = ranking.filter((r) => r.kmL != null).map((r) => ({ nome: r.nome, kmL: Number(r.kmL!.toFixed(2)) }))

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
      <h1 className="mb-5 text-2xl font-bold text-slate-800 dark:text-slate-100">Eficiência</h1>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400 dark:text-slate-500">Carregando…</div>
      ) : efi.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-355 bg-white py-16 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40">
          <Gauge className="h-10 w-10 text-slate-500" />
          <p className="text-sm">Sem dados de KM suficientes para calcular eficiência.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800/80 dark:bg-slate-900/60 dark:backdrop-blur-md">
              <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Consumo médio (km/l) por veículo</h2>
              <ResponsiveContainer width="100%" height={Math.max(200, chartKmL.length * 34)}>
                <BarChart data={chartKmL} layout="vertical" margin={{ left: 20, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: chartTheme.text }} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: chartTheme.text }} width={70} />
                  <Tooltip
                    contentStyle={chartTheme.tooltip.contentStyle}
                    itemStyle={chartTheme.tooltip.itemStyle}
                    labelStyle={chartTheme.tooltip.labelStyle}
                    formatter={(v) => `${fmtNum(Number(v), 1)} km/l`}
                  />
                  <Bar dataKey="kmL" radius={[0, 4, 4, 0]}>
                    {chartKmL.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800/80 dark:bg-slate-900/60 dark:backdrop-blur-md">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Evolução do consumo</h2>
                <select
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-brand-500"
                  value={sel}
                  onChange={(e) => setSel(e.target.value)}
                >
                  <option value="">Selecione um veículo…</option>
                  {ranking.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </div>
              {serieSel.length === 0 ? (
                <div className="py-20 text-center text-sm text-slate-400 dark:text-slate-500">Selecione um veículo com histórico.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={serieSel} margin={{ left: -10, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                    <XAxis dataKey="data" tick={{ fontSize: 10, fill: chartTheme.text }} />
                    <YAxis tick={{ fontSize: 11, fill: chartTheme.text }} />
                    <Tooltip
                      contentStyle={chartTheme.tooltip.contentStyle}
                      itemStyle={chartTheme.tooltip.itemStyle}
                      labelStyle={chartTheme.tooltip.labelStyle}
                      formatter={(v) => `${fmtNum(Number(v), 1)} km/l`}
                    />
                    <Line dataKey="kmL" stroke="#16a34a" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800/80 dark:bg-slate-900/60 dark:backdrop-blur-md">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-left text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Veículo</th>
                  <th className="px-4 py-3 text-right">Consumo</th>
                  <th className="px-4 py-3 text-right">Custo/km</th>
                  <th className="px-4 py-3 text-right">Km rodado</th>
                  <th className="px-4 py-3 text-right">Litros</th>
                  <th className="px-4 py-3 text-right">Gasto</th>
                  <th className="px-4 py-3 text-right">Abast.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {ranking.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{r.nome}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{r.kmL ? `${fmtNum(r.kmL, 1)} km/l` : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-600 dark:text-rose-450">{r.rsKm ? fmtBRL(r.rsKm) : '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{fmtNum(r.kmRodado, 0)} km</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{fmtNum(r.litros)} L</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{fmtBRL(r.valor)}</td>
                    <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-450">{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </motion.div>
  )
}
