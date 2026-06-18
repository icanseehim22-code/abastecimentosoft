import { useMemo, useState, useEffect } from 'react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts'
import {
  FileText, Printer, Fuel, DollarSign, TrendingUp, Award,
  MapPin, Zap, Download, Sparkles, Target, AlertTriangle, Check
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  useAbastecimentos, useEficiencia, useVeiculos, useMotoristas, useMetas
} from '../lib/queries'
import { fmtBRL, fmtNum } from '../lib/format'
import { Select, Input } from '../components/ui/fields'

const CORES_PIE = ['#3b62f0', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

export default function Relatorios() {
  // Inicializa datas com o mês corrente
  const { primeiroDia, hoje } = useMemo(() => {
    const now = new Date()
    const ano = now.getFullYear()
    const mes = String(now.getMonth() + 1).padStart(2, '0')
    return {
      primeiroDia: `${ano}-${mes}-01`,
      hoje: now.toISOString().split('T')[0]
    }
  }, [])

  const [filtros, setFiltros] = useState({
    inicio: primeiroDia,
    fim: hoje,
    veiculoId: '',
    motoristaId: '',
    combustivel: ''
  })

  // Dados do banco
  const { data: veiculos = [] } = useVeiculos()
  const { data: motoristas = [] } = useMotoristas()
  const { data: abastecimentosRaw = [] } = useAbastecimentos({
    inicio: filtros.inicio,
    fim: filtros.fim,
    veiculoId: filtros.veiculoId,
    combustivel: filtros.combustivel
  })
  const { data: eficienciaRows = [] } = useEficiencia()

  // Carrega as metas do banco com base no mês do filtro inicial
  const parsedPeriod = useMemo(() => {
    try {
      const [year, month] = filtros.inicio.split('-').map(Number)
      return { year, month }
    } catch {
      const now = new Date()
      return { year: now.getFullYear(), month: now.getMonth() + 1 }
    }
  }, [filtros.inicio])

  const { data: metas = [] } = useMetas(parsedPeriod.year, parsedPeriod.month)

  // Orçamento Global Programado (Local State com fallback)
  const [verbaGlobal, setVerbaGlobal] = useState<number>(10000)

  // Encontra a verba global configurada no banco (tabela metas)
  const metaGlobalBanco = useMemo(() => {
    const meta = metas.find(m => m.escopo === 'global')
    return meta?.limite_valor ?? null
  }, [metas])

  const limiteVerbaEfetivo = metaGlobalBanco ?? verbaGlobal

  // PERSISTÊNCIA DE OS: Carrega/Salva no localStorage do navegador por período
  const [osMap, setOsMap] = useState<Record<string, number>>({})

  const storageKey = useMemo(() => `os_map_${filtros.inicio}_${filtros.fim}`, [filtros.inicio, filtros.fim])

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        setOsMap(JSON.parse(saved))
      } catch {
        setOsMap({})
      }
    } else {
      setOsMap({})
    }
  }, [storageKey])

  const salvarOS = (veiculoId: string, val: number) => {
    const newMap = { ...osMap, [veiculoId]: val }
    setOsMap(newMap)
    localStorage.setItem(storageKey, JSON.stringify(newMap))
  }

  // Veículos desconsiderados temporariamente no relatório
  const [excluidos, setExcluidos] = useState<Record<string, boolean>>({})

  // Relacionar vw_abastecimentos com vw_eficiencia (pelo ID do abastecimento)
  const eficienciaMap = useMemo(() => {
    const map = new Map<string, typeof eficienciaRows[0]>()
    for (const row of eficienciaRows) {
      map.set(row.id, row)
    }
    return map
  }, [eficienciaRows])

  // Filtrar motorista localmente
  const abastecimentos = useMemo(() => {
    let list = abastecimentosRaw
    if (filtros.motoristaId) {
      list = list.filter((a) => a.motorista_id === filtros.motoristaId)
    }
    return list
  }, [abastecimentosRaw, filtros.motoristaId])

  // KPIs Gerais (apenas de veículos incluídos)
  const kpis = useMemo(() => {
    let totalGasto = 0
    let totalLitros = 0
    let totalKmRodado = 0
    let litrosParaMedia = 0
    let kmParaMedia = 0

    for (const r of abastecimentos) {
      if (excluidos[r.veiculo_id]) continue

      totalGasto += Number(r.valor)
      totalLitros += Number(r.litros)

      const ef = eficienciaMap.get(r.id)
      if (ef && ef.km_rodado && ef.km_rodado > 0) {
        totalKmRodado += ef.km_rodado
        if (ef.km_por_litro !== null) {
          kmParaMedia += ef.km_rodado
          litrosParaMedia += Number(r.litros)
        }
      }
    }

    const kmPorLitroMedio = litrosParaMedia > 0 ? kmParaMedia / litrosParaMedia : null
    const custoPorKm = totalKmRodado > 0 ? totalGasto / totalKmRodado : null

    return {
      totalGasto,
      totalLitros,
      totalKmRodado,
      kmPorLitroMedio,
      custoPorKm
    }
  }, [abastecimentos, eficienciaMap, excluidos])

  // Projeção de Gastos (Burn Rate)
  const projecaoOrcamento = useMemo(() => {
    if (abastecimentos.length === 0 || kpis.totalGasto === 0) {
      return { dailyRate: 0, projectedSpend: 0, ratio: 0, estouro: false }
    }

    const d1 = new Date(filtros.inicio)
    const d2 = new Date(filtros.fim)
    const diffTime = Math.abs(d2.getTime() - d1.getTime())
    const days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1)

    const dailyRate = kpis.totalGasto / days
    const projectedSpend = dailyRate * 30 // Projeta o mês padrão (30 dias)
    const ratio = projectedSpend / limiteVerbaEfetivo
    const estouro = ratio > 1.0

    return {
      dailyRate,
      projectedSpend,
      ratio,
      estouro
    }
  }, [abastecimentos, kpis.totalGasto, filtros.inicio, filtros.fim, limiteVerbaEfetivo])

  // Estatísticas por veículo para o relatório cruzado com OS
  const veiculoStats = useMemo(() => {
    const stats: Record<string, {
      veiculoId: string
      nome: string
      placa: string
      valorTotal: number
      litrosTotal: number
      kmRodadoTotal: number
      litrosParaMedia: number
      kmParaMedia: number
      count: number
      incluido: boolean
    }> = {}

    for (const r of abastecimentos) {
      const ef = eficienciaMap.get(r.id)
      const vId = r.veiculo_id
      const incluido = !excluidos[vId]

      if (!stats[vId]) {
        stats[vId] = {
          veiculoId: vId,
          nome: r.veiculo_nome,
          placa: r.placa,
          valorTotal: 0,
          litrosTotal: 0,
          kmRodadoTotal: 0,
          litrosParaMedia: 0,
          kmParaMedia: 0,
          count: 0,
          incluido
        }
      }

      const s = stats[vId]
      s.valorTotal += Number(r.valor)
      s.litrosTotal += Number(r.litros)
      s.count += 1

      if (ef && ef.km_rodado && ef.km_rodado > 0) {
        s.kmRodadoTotal += ef.km_rodado
        if (ef.km_por_litro !== null) {
          s.kmParaMedia += ef.km_rodado
          s.litrosParaMedia += Number(r.litros)
        }
      }
    }

    // Calcula a média de OS/Litro para atribuir notas relativas (apenas para veículos incluídos)
    const items = Object.values(stats)
    let totalOS = 0
    let totalLitrosComOS = 0

    items.forEach((item) => {
      if (!item.incluido) return
      const os = osMap[item.veiculoId] || 0
      if (os > 0) {
        totalOS += os
        totalLitrosComOS += item.litrosTotal
      }
    })

    const avgOSPorLitro = totalLitrosComOS > 0 ? totalOS / totalLitrosComOS : 0

    return items.map((item) => {
      const os = osMap[item.veiculoId] || 0
      const custoPorOS = os > 0 ? item.valorTotal / os : null
      const kmPorOS = os > 0 ? item.kmRodadoTotal / os : null
      const osPorLitro = os > 0 ? os / item.litrosTotal : 0

      // Cálculo da Nota Relativa
      let nota = '—'
      if (item.incluido && os > 0 && avgOSPorLitro > 0) {
        const ratio = osPorLitro / avgOSPorLitro
        if (ratio >= 1.25) nota = 'S (Excelente)'
        else if (ratio >= 0.95) nota = 'A (Bom)'
        else if (ratio >= 0.70) nota = 'B (Regular)'
        else nota = 'C (Atenção)'
      }

      return {
        ...item,
        os,
        custoPorOS,
        kmPorOS,
        osPorLitro,
        nota
      }
    }).sort((a, b) => b.valorTotal - a.valorTotal)
  }, [abastecimentos, eficienciaMap, osMap, excluidos])

  // Leaderboard / Ranking de Condução Econômica dos Motoristas
  const motoristaRanking = useMemo(() => {
    const stats: Record<string, {
      nome: string
      litrosValidos: number
      kmValidos: number
      valorTotal: number
      abastecimentosCount: number
    }> = {}

    for (const r of abastecimentos) {
      if (excluidos[r.veiculo_id]) continue
      const motoristaNome = r.motorista?.trim() || 'Não informado'
      const ef = eficienciaMap.get(r.id)

      if (!stats[motoristaNome]) {
        stats[motoristaNome] = {
          nome: motoristaNome,
          litrosValidos: 0,
          kmValidos: 0,
          valorTotal: 0,
          abastecimentosCount: 0
        }
      }

      const s = stats[motoristaNome]
      s.valorTotal += Number(r.valor)
      s.abastecimentosCount += 1

      if (ef && ef.km_rodado && ef.km_rodado > 0 && ef.km_por_litro !== null) {
        s.kmValidos += ef.km_rodado
        s.litrosValidos += Number(r.litros)
      }
    }

    return Object.values(stats)
      .map((s) => {
        const media = s.litrosValidos > 0 ? s.kmValidos / s.litrosValidos : null
        return {
          ...s,
          media
        }
      })
      .filter(s => s.media !== null)
      .sort((a, b) => (b.media ?? 0) - (a.media ?? 0)) // Mais econômico primeiro
  }, [abastecimentos, eficienciaMap, excluidos])

  // Gráfico 1: Gasto por Combustível (apenas incluídos)
  const dadosCombustivel = useMemo(() => {
    const resumo: Record<string, number> = {}
    for (const r of abastecimentos) {
      if (excluidos[r.veiculo_id]) continue
      resumo[r.combustivel] = (resumo[r.combustivel] || 0) + Number(r.valor)
    }
    return Object.entries(resumo).map(([name, value]) => ({ name, value }))
  }, [abastecimentos, excluidos])

  // Gráfico 2: Evolução de Gastos Diários (apenas incluídos)
  const dadosEvolucao = useMemo(() => {
    const resumo: Record<string, number> = {}
    for (const r of abastecimentos) {
      if (excluidos[r.veiculo_id]) continue
      const dataFormat = r.data.substring(5, 10).split('-').reverse().join('/') // MM-DD -> DD/MM
      resumo[dataFormat] = (resumo[dataFormat] || 0) + Number(r.valor)
    }
    return Object.entries(resumo)
      .map(([date, valor]) => ({ date, valor }))
      .sort((a, b) => {
        const [da, ma] = a.date.split('/').map(Number)
        const [db, mb] = b.date.split('/').map(Number)
        return ma === mb ? da - db : ma - mb
      })
  }, [abastecimentos, excluidos])

  // Gráfico 3: Histórico de Preços por Litro (Tendência / Inflação)
  const dadosPrecoCombustivel = useMemo(() => {
    const dataGroups: Record<string, Record<string, { totalPreco: number; count: number }>> = {}

    for (const r of abastecimentos) {
      if (excluidos[r.veiculo_id] || !r.preco_litro) continue
      const dateStr = r.data.substring(5, 10).split('-').reverse().join('/')

      if (!dataGroups[dateStr]) dataGroups[dateStr] = {}
      if (!dataGroups[dateStr][r.combustivel]) {
        dataGroups[dateStr][r.combustivel] = { totalPreco: 0, count: 0 }
      }

      const g = dataGroups[dateStr][r.combustivel]
      g.totalPreco += Number(r.preco_litro)
      g.count += 1
    }

    return Object.entries(dataGroups)
      .map(([date, combs]) => {
        const row: any = { date }
        for (const [comb, data] of Object.entries(combs)) {
          row[comb] = data.count > 0 ? Number((data.totalPreco / data.count).toFixed(3)) : null
        }
        return row
      })
      .sort((a, b) => {
        const [da, ma] = a.date.split('/').map(Number)
        const [db, mb] = b.date.split('/').map(Number)
        return ma === mb ? da - db : ma - mb
      })
  }, [abastecimentos, excluidos])

  // Geração Automática de Insights Executivos (apenas incluídos)
  const insights = useMemo(() => {
    const list: string[] = []
    const statsIncluidos = veiculoStats.filter(v => v.incluido)
    if (statsIncluidos.length === 0) return ['Sem dados suficientes no período selecionado.']

    // Custo Médio do Litro
    const precoMedioL = kpis.totalLitros > 0 ? kpis.totalGasto / kpis.totalLitros : 0
    list.push(`Custo Médio: O preço médio pago por litro de combustível foi de **R$ ${precoMedioL.toFixed(2)}** no período.`)

    // Veículo com maior gasto
    if (statsIncluidos.length > 0) {
      const topGasto = statsIncluidos[0]
      const pct = kpis.totalGasto > 0 ? (topGasto.valorTotal / kpis.totalGasto) * 100 : 0
      list.push(`Maior Despesa: O veículo **${topGasto.nome}** (${topGasto.placa}) liderou os custos, representando **R$ ${fmtNum(topGasto.valorTotal)}** (${pct.toFixed(1)}% do total).`)
    }

    // Veículo mais econômico
    const comMedia = statsIncluidos.filter(v => v.kmParaMedia > 0 && v.litrosParaMedia > 0)
    if (comMedia.length > 0) {
      const melhorKml = [...comMedia].sort((a, b) => (b.kmParaMedia / b.litrosParaMedia) - (a.kmParaMedia / a.litrosParaMedia))[0]
      const piorKml = [...comMedia].sort((a, b) => (a.kmParaMedia / a.litrosParaMedia) - (b.kmParaMedia / b.litrosParaMedia))[0]

      list.push(`Melhor Consumo: **${melhorKml.nome}** obteve a melhor média de consumo com **${(melhorKml.kmParaMedia / melhorKml.litrosParaMedia).toFixed(2)} km/l**.`);
      if (piorKml.veiculoId !== melhorKml.veiculoId) {
        list.push(`Atenção: O veículo **${piorKml.nome}** teve o pior desempenho médio, registrando **${(piorKml.kmParaMedia / piorKml.litrosParaMedia).toFixed(2)} km/l**.`);
      }
    }

    // Cruzamento com OS
    const comOS = statsIncluidos.filter(v => v.os > 0)
    if (comOS.length > 0) {
      // Melhor Custo por OS
      const melhorCustoOS = [...comOS].sort((a, b) => (a.custoPorOS || 0) - (b.custoPorOS || 0))[0]
      if (melhorCustoOS && melhorCustoOS.custoPorOS) {
        list.push(`Eficiência de Serviço: **${melhorCustoOS.nome}** teve o menor custo de combustível por OS executada (**R$ ${melhorCustoOS.custoPorOS.toFixed(2)}/OS**).`)
      }

      // Melhor Rota (menor Km por OS)
      const melhorKmOS = [...comOS].sort((a, b) => (a.kmPorOS || 0) - (b.kmPorOS || 0))[0]
      if (melhorKmOS && melhorKmOS.kmPorOS) {
        list.push(`Logística/Rotas: O técnico do **${melhorKmOS.nome}** viajou em média apenas **${melhorKmOS.kmPorOS.toFixed(1)} km por atendimento**, indicando excelente agrupamento geográfico de visitas.`)
      }
    }

    return list
  }, [kpis, veiculoStats])

  function formatarDataBR(dataStr: string) {
    if (!dataStr) return ''
    const [ano, mes, dia] = dataStr.split('-')
    return `${dia}/${mes}/${ano}`
  }

  // Exportação Excel (CSV)
  function exportarCSV() {
    const headers = [
      'Data', 'Veiculo', 'Placa', 'Motorista', 'Posto',
      'Combustivel', 'Litros', 'Valor (R$)', 'Preco/L (R$)',
      'KM', 'KM Rodado', 'Eficiencia (km/l)'
    ]

    const rows = abastecimentos.filter(r => !excluidos[r.veiculo_id]).map((r) => {
      const ef = eficienciaMap.get(r.id)
      return [
        formatarDataBR(r.data),
        r.veiculo_nome,
        r.placa,
        r.motorista || '—',
        r.posto || '—',
        r.combustivel,
        r.litros,
        r.valor,
        r.preco_litro || '—',
        r.km || '—',
        ef?.km_rodado || '—',
        ef?.km_por_litro ? ef.km_por_litro.toFixed(2) : '—'
      ]
    })

    const csvContent = [
      headers.join(';'),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `relatorio_frota_${filtros.inicio}_a_${filtros.fim}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .print-page-break {
            break-before: page !important;
            page-break-before: always !important;
            margin-top: 0 !important;
            padding-top: 2rem !important;
          }
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}} />

      {/* CABEÇALHO PARA IMPRESSÃO */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900 uppercase">Relatório Executivo de Rendimento e Frota</h1>
            <p className="text-xs text-slate-500 mt-1">Período: {formatarDataBR(filtros.inicio)} a {formatarDataBR(filtros.fim)}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Gestão de Abastecimento Soft</div>
            <div>Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
      </div>

      {/* CABEÇALHO DA TELA (HIDDEN NA IMPRESSÃO) */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Relatório Executivo</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Dados consolidados de desempenho e gastos da frota.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportarCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-350 dark:hover:bg-slate-800"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/10 hover:bg-brand-700 transition"
          >
            <Printer className="h-4 w-4" /> Imprimir Relatório
          </button>
        </div>
      </div>

      {/* FILTROS (HIDDEN NA IMPRESSÃO) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md print:hidden">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Data Início</label>
            <Input type="date" value={filtros.inicio} onChange={(e) => setFiltros({ ...filtros, inicio: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Data Fim</label>
            <Input type="date" value={filtros.fim} onChange={(e) => setFiltros({ ...filtros, fim: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Veículo</label>
            <Select value={filtros.veiculoId} onChange={(e) => setFiltros({ ...filtros, veiculoId: e.target.value })}>
              <option value="">Todos</option>
              {veiculos.map(v => <option key={v.id} value={v.id}>{v.nome} ({v.placa})</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Motorista / Técnico</label>
            <Select value={filtros.motoristaId} onChange={(e) => setFiltros({ ...filtros, motoristaId: e.target.value })}>
              <option value="">Todos</option>
              {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Combustível</label>
            <Select value={filtros.combustivel} onChange={(e) => setFiltros({ ...filtros, combustivel: e.target.value })}>
              <option value="">Todos</option>
              <option value="Gasolina">Gasolina</option>
              <option value="Etanol">Etanol</option>
              <option value="Diesel">Diesel</option>
              <option value="GNV">GNV</option>
            </Select>
          </div>
        </div>
      </div>

      {/* SEÇÃO ORÇAMENTO & BURN RATE (HIDDEN NA IMPRESSÃO) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm md:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="h-4.5 w-4.5 text-brand-500" /> Projeção de Orçamento (Burn Rate)
            </h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-semibold">Orçamento Alvo:</label>
              {metaGlobalBanco ? (
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{fmtBRL(metaGlobalBanco)} (Banco)</span>
              ) : (
                <input
                  type="number"
                  value={verbaGlobal}
                  onChange={(e) => setVerbaGlobal(Math.max(1, Number(e.target.value) || 0))}
                  className="w-24 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none"
                />
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-6 items-center">
            {/* Medidor Circular de Ritmo */}
            <div className="relative h-28 w-28 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="56" cy="56" r="48" strokeWidth="8" stroke="#e2e8f0" fill="transparent" className="dark:stroke-slate-800" />
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  strokeWidth="8"
                  stroke={projecaoOrcamento.estouro ? '#ef4444' : '#10b981'}
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 48}
                  strokeDashoffset={2 * Math.PI * 48 * (1 - Math.min(1.2, projecaoOrcamento.ratio))}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-xs font-bold text-slate-400">Projeção</span>
                <span className={`text-base font-extrabold ${projecaoOrcamento.estouro ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {((projecaoOrcamento.ratio || 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Informações Textuais */}
            <div className="space-y-2 flex-1">
              <p className="text-sm text-slate-650 dark:text-slate-350">
                Gasto diário médio de **{fmtBRL(projecaoOrcamento.dailyRate)}/dia**. 
                Neste ritmo, o consumo mensal estimado é de **{fmtBRL(projecaoOrcamento.projectedSpend)}** para o limite estabelecido de {fmtBRL(limiteVerbaEfetivo)}.
              </p>
              {projecaoOrcamento.estouro ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-3 py-1.5 rounded-lg border border-rose-100 dark:border-rose-900/30">
                  <AlertTriangle className="h-4 w-4 animate-bounce" /> Atenção: Risco iminente de estouro de orçamento em {fmtBRL(projecaoOrcamento.projectedSpend - limiteVerbaEfetivo)}.
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                  <Check className="h-4 w-4" /> Consumo projetado dentro dos limites aprovados para o período.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* METAS ATIVAS BANCO DO MÊS (REFERÊNCIA DE CONSULTA) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm flex flex-col justify-between">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
            Metas do Mês ({parsedPeriod.month}/{parsedPeriod.year})
          </h2>
          <div className="mt-3 space-y-2 flex-1 max-h-32 overflow-y-auto">
            {metas.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">Nenhuma meta específica cadastrada no Supabase para este mês.</div>
            ) : (
              metas.map((m) => (
                <div key={m.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 dark:border-slate-800/30">
                  <span className="text-slate-650 dark:text-slate-400 capitalize">
                    {m.escopo === 'global' ? 'Global' : m.escopo === 'veiculo' ? `Veículo (Placa: ${veiculos.find(v => v.id === m.ref_id)?.placa || '—'})` : 'Motorista'}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {m.limite_valor ? fmtBRL(m.limite_valor) : `${m.limite_litros} L`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* CARDS DE KPIS */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5 print:grid-cols-5 print:gap-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 print:p-2 print:shadow-none shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase">Custo Total</span>
            <DollarSign className="h-4 w-4 text-brand-500" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100 print:text-base">{fmtBRL(kpis.totalGasto)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 print:p-2 print:shadow-none shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase">Volume Total</span>
            <Fuel className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100 print:text-base">{fmtNum(kpis.totalLitros)} L</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 print:p-2 print:shadow-none shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase">Distância</span>
            <MapPin className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100 print:text-base">{fmtNum(kpis.totalKmRodado, 0)} km</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 print:p-2 print:shadow-none shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase">Média Geral</span>
            <Zap className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100 print:text-base">
              {kpis.kmPorLitroMedio ? `${kpis.kmPorLitroMedio.toFixed(2)} km/l` : '—'}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 print:p-2 print:shadow-none shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase">Custo por KM</span>
            <TrendingUp className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100 print:text-base">
              {kpis.custoPorKm ? fmtBRL(kpis.custoPorKm) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* QUADRO DE INSIGHTS EXECUTIVOS */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-brand-500/5 to-indigo-500/5 p-5 dark:border-slate-800/80 dark:bg-slate-900/20">
        <h2 className="text-sm font-bold text-brand-800 dark:text-brand-400 uppercase tracking-wider flex items-center gap-2 mb-3">
          <Award className="h-4.5 w-4.5" /> Insights da Diretoria
        </h2>
        <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-350">
          {insights.map((ins, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"></span>
              <span dangerouslySetInnerHTML={{ __html: ins.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </li>
          ))}
        </ul>
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 print:grid-cols-3 print:gap-2">
        {/* Distribuição por Combustível */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm flex flex-col min-w-0">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Gastos por Combustível</h3>
          <div className="w-full h-48">
            {dadosCombustivel.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={192}>
                <PieChart>
                  <Pie
                    data={dadosCombustivel}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {dadosCombustivel.map((entry, idx) => (
                      <Cell key={entry.name} fill={CORES_PIE[idx % CORES_PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Evolução de Gastos */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm flex flex-col min-w-0">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Histórico de Gastos</h3>
          <div className="w-full h-48">
            {dadosEvolucao.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={192}>
                <AreaChart data={dadosEvolucao} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b62f0" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b62f0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip formatter={(v) => fmtBRL(Number(v))} labelStyle={{ color: '#64748b' }} />
                  <Area type="monotone" dataKey="valor" stroke="#3b62f0" strokeWidth={2} fillOpacity={1} fill="url(#colorValor)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Tendência e Inflação de Preços */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm flex flex-col min-w-0">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Inflação (R$/L Médio)</h3>
          <div className="w-full h-48">
            {dadosPrecoCombustivel.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">Sem dados de preço</div>
            ) : (
              <ResponsiveContainer width="100%" height={192}>
                <LineChart data={dadosPrecoCombustivel} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip formatter={(v) => fmtBRL(Number(v))} labelStyle={{ color: '#64748b' }} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Gasolina" stroke="#3b62f0" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="Etanol" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="Diesel" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO INTERATIVA: OS x DESEMPENHO */}
      <div className="print-page-break rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md shadow-sm print:border-none print:shadow-none">
        <div className="border-b border-slate-100 dark:border-slate-800 p-5">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-500" /> Desempenho Cruzado (Carro x OS Executadas)
          </h2>
          <p className="text-xs text-slate-400 mt-1 print:hidden">
            Preencha as Ordens de Serviço (OS) de cada carro no período. O sistema calcula a produtividade real e metas visuais associadas.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-left text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 print:hidden w-10"></th>
                <th className="px-4 py-3">Veículo / Técnico</th>
                <th className="px-4 py-3 print:w-16 w-32">Nº de OS</th>
                <th className="px-4 py-3">Meta Mensal (Custo)</th>
                <th className="px-4 py-3 text-right">Custo Total</th>
                <th className="px-4 py-3 text-right">Custo/OS</th>
                <th className="px-4 py-3 text-right">KM/OS</th>
                <th className="px-4 py-3 text-right">OS/Litro</th>
                <th className="px-4 py-3 text-center">Conceito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {veiculoStats.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">Nenhum veículo ativo no período.</td></tr>
              ) : (
                veiculoStats.map((s) => {
                  // Busca a meta cadastrada no banco para este veículo
                  const metaVeiculo = metas.find(m => m.escopo === 'veiculo' && m.ref_id === s.veiculoId)
                  const limiteValor = metaVeiculo?.limite_valor ?? null
                  const percentGasto = limiteValor ? Math.min(100, (s.valorTotal / limiteValor) * 100) : null
                  const superouMeta = limiteValor && s.valorTotal > limiteValor

                  return (
                    <tr key={s.veiculoId} className={`${s.incluido ? '' : 'opacity-40 print:hidden'} hover:bg-slate-50/40 dark:hover:bg-slate-800/20`}>
                      <td className="px-4 py-3 print:hidden">
                        <input
                          type="checkbox"
                          checked={s.incluido}
                          onChange={(e) => {
                            setExcluidos({
                              ...excluidos,
                              [s.veiculoId]: !e.target.checked
                            })
                          }}
                          className="rounded accent-brand-600 cursor-pointer h-4 w-4"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{s.nome}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">{s.placa} • {s.count} abastecimentos</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="hidden print:inline font-bold text-slate-800">{s.os || '0'}</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={osMap[s.veiculoId] ?? ''}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0)
                            salvarOS(s.veiculoId, val)
                          }}
                          className="print:hidden w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {limiteValor && percentGasto !== null ? (
                          <div className="w-full space-y-1 max-w-[150px]">
                            <div className="flex justify-between text-xxs font-bold">
                              <span className={superouMeta ? 'text-rose-600' : percentGasto > 75 ? 'text-amber-600' : 'text-emerald-600'}>
                                {percentGasto.toFixed(0)}%
                              </span>
                              <span className="text-slate-400">Limite: {fmtNum(limiteValor, 0)}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${superouMeta ? 'bg-rose-500' : percentGasto > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${percentGasto}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xxs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-750 dark:text-slate-350">{fmtBRL(s.valorTotal)}</td>
                      <td className="px-4 py-3 text-right text-slate-750 dark:text-slate-350 font-medium">
                        {s.custoPorOS ? fmtBRL(s.custoPorOS) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-650 dark:text-slate-400">
                        {s.kmPorOS ? `${s.kmPorOS.toFixed(1)} km/OS` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-650 dark:text-slate-400">
                        {s.os > 0 ? `${s.osPorLitro.toFixed(3)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.nota === '—' ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            s.nota.startsWith('S')
                              ? 'bg-purple-105 bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
                              : s.nota.startsWith('A')
                              ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                              : s.nota.startsWith('B')
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                          }`}>
                            {s.nota.split(' ')[0]}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LEADERBOARD / RANKING DE MOTORISTAS */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md shadow-sm">
        <div className="border-b border-slate-100 dark:border-slate-800 p-5">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" /> Ranking de Condução Econômica (Leaderboard)
          </h2>
          <p className="text-xs text-slate-400 mt-1">Classificação de motoristas que conseguiram melhor desempenho de consumo (km/l) no período.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-left text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 text-center w-16">Posição</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3 text-right">Abastecimentos</th>
                <th className="px-4 py-3 text-right">Volume Total (L)</th>
                <th className="px-4 py-3 text-right">Distância Válida</th>
                <th className="px-4 py-3 text-right">Média de Consumo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {motoristaRanking.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">Sem dados de eficiência para motoristas no período.</td></tr>
              ) : (
                motoristaRanking.map((m, index) => {
                  const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null
                  return (
                    <tr key={m.nome} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20">
                      <td className="px-4 py-3 text-center font-bold text-slate-700">
                        {medal ? <span className="text-lg">{medal}</span> : `${index + 1}º`}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-850 dark:text-slate-200">{m.nome}</td>
                      <td className="px-4 py-3 text-right text-slate-650 dark:text-slate-400">{m.abastecimentosCount}x</td>
                      <td className="px-4 py-3 text-right text-slate-650 dark:text-slate-400">{fmtNum(m.litrosValidos)} L</td>
                      <td className="px-4 py-3 text-right text-slate-650 dark:text-slate-400">{fmtNum(m.kmValidos, 0)} km</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {m.media ? `${m.media.toFixed(2)} km/l` : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETALHAMENTO DE REGISTROS */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md shadow-sm">
        <div className="border-b border-slate-100 dark:border-slate-800 p-5">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" /> Registro Detalhado de Abastecimentos
          </h2>
          <p className="text-xs text-slate-400 mt-1">Lista completa de ocorrências no período selecionado.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-left text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Posto</th>
                <th className="px-4 py-3 text-right">Litros</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">R$/Litro</th>
                <th className="px-4 py-3 text-right">Km Rodado</th>
                <th className="px-4 py-3 text-right">Média (km/l)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {abastecimentos.filter(r => !excluidos[r.veiculo_id]).length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">Nenhum registro correspondente aos filtros.</td></tr>
              ) : (
                abastecimentos
                  .filter(r => !excluidos[r.veiculo_id])
                  .map((r) => {
                    const ef = eficienciaMap.get(r.id)
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/45 dark:hover:bg-slate-800/20">
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-350">{formatarDataBR(r.data)}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{r.veiculo_nome}</span>
                          <span className="block text-xxs text-slate-450 dark:text-slate-500">{r.placa}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-350">{r.motorista || '—'}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-350">{r.posto || '—'}</td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{fmtNum(r.litros)}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-350">{fmtBRL(r.valor)}</td>
                        <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-450">{r.preco_litro ? fmtBRL(r.preco_litro) : '—'}</td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-455">
                          {ef && ef.km_rodado && ef.km_rodado > 0 ? `${fmtNum(ef.km_rodado, 0)} km` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300 font-semibold">
                          {ef && ef.km_por_litro ? `${ef.km_por_litro.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    )
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ASSINATURAS PARA IMPRESSÃO */}
      <div className="hidden print:block print-avoid-break pt-16">
        <div className="grid grid-cols-2 gap-16 text-center text-xs">
          <div>
            <div className="border-t border-slate-400 w-64 mx-auto pt-2"></div>
            <div className="font-bold text-slate-850">Gestor de Frota</div>
            <div className="text-slate-400 mt-1">Marco Aurélio</div>
          </div>
          <div>
            <div className="border-t border-slate-400 w-64 mx-auto pt-2"></div>
            <div className="font-bold text-slate-850">Diretor Responsável</div>
            <div className="text-slate-400 mt-1">Assinatura / Autorização</div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
