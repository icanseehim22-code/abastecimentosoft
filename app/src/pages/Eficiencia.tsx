import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell,
} from 'recharts'
import { Gauge } from 'lucide-react'
import { useEficiencia, useVeiculos } from '../lib/queries'
import { fmtBRL, fmtNum, fmtDataBR } from '../lib/format'
import { soma } from '../lib/analytics'

const PALETA = ['#16a34a', '#3b62f0', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6']

export default function Eficiencia() {
  const { data: efi = [], isLoading } = useEficiencia()
  const { data: veiculos = [] } = useVeiculos(true)
  const [sel, setSel] = useState<string>('')

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

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-slate-800">Eficiência</h1>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400">Carregando…</div>
      ) : efi.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-slate-400">
          <Gauge className="h-10 w-10" />
          <p className="text-sm">Sem dados de KM suficientes para calcular eficiência.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Consumo médio (km/l) por veículo</h2>
              <ResponsiveContainer width="100%" height={Math.max(200, chartKmL.length * 34)}>
                <BarChart data={chartKmL} layout="vertical" margin={{ left: 20, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(v) => `${fmtNum(Number(v), 1)} km/l`} />
                  <Bar dataKey="kmL" radius={[0, 4, 4, 0]}>
                    {chartKmL.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Evolução do consumo</h2>
                <select className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={sel} onChange={(e) => setSel(e.target.value)}>
                  <option value="">Selecione um veículo…</option>
                  {ranking.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </div>
              {serieSel.length === 0 ? (
                <div className="py-20 text-center text-sm text-slate-400">Selecione um veículo com histórico.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={serieSel} margin={{ left: -10, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `${fmtNum(Number(v), 1)} km/l`} />
                    <Line dataKey="kmL" stroke="#16a34a" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
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
              <tbody className="divide-y divide-slate-100">
                {ranking.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.nome}</td>
                    <td className="px-4 py-3 text-right">{r.kmL ? `${fmtNum(r.kmL, 1)} km/l` : '—'}</td>
                    <td className="px-4 py-3 text-right">{r.rsKm ? fmtBRL(r.rsKm) : '—'}</td>
                    <td className="px-4 py-3 text-right">{fmtNum(r.kmRodado, 0)} km</td>
                    <td className="px-4 py-3 text-right">{fmtNum(r.litros)} L</td>
                    <td className="px-4 py-3 text-right">{fmtBRL(r.valor)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
