import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts'
import {
  FileText, Printer, Fuel, DollarSign,
  TrendingUp, Award, MapPin, Zap
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  useAbastecimentos, useEficiencia, useVeiculos, useMotoristas
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

  // Mapeamento de OS preenchidas manualmente
  const [osMap, setOsMap] = useState<Record<string, number>>({})

  // Veículos desconsiderados no relatório
  const [excluidos, setExcluidos] = useState<Record<string, boolean>>({})

  // Relacionar vw_abastecimentos com vw_eficiencia (pelo ID do abastecimento)
  const eficienciaMap = useMemo(() => {
    const map = new Map<string, typeof eficienciaRows[0]>()
    for (const row of eficienciaRows) {
      map.set(row.id, row)
    }
    return map
  }, [eficienciaRows])

  // Filtrar motorista localmente (já que o endpoint do useAbastecimentos não faz filtro nativo por ID de motorista)
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
  }, [abastecimentos, kpis, veiculoStats])

  function formatarDataBR(dataStr: string) {
    if (!dataStr) return ''
    const [ano, mes, dia] = dataStr.split('-')
    return `${dia}/${mes}/${ano}`
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
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/10 hover:bg-brand-700 transition"
        >
          <Printer className="h-4 w-4" /> Imprimir Relatório
        </button>
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
          <Award className="h-4 w-4" /> Insights da Diretoria
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

      {/* GRÁFICOS (HIDDEN NA IMPRESSÃO SE FICAR MUITO GRANDE OU SIMPLIFICADO) */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 print:grid-cols-3 print:gap-2">
        {/* Distribuição por Combustível */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm flex flex-col">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Gastos por Combustível</h3>
          <div className="h-48 flex-1">
            {dadosCombustivel.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm md:col-span-2 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Histórico de Gastos no Período</h3>
          <div className="h-48 flex-1">
            {dadosEvolucao.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
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
      </div>

      {/* SEÇÃO INTERATIVA: OS x DESEMPENHO */}
      <div className="print-page-break rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md shadow-sm print:border-none print:shadow-none">
        <div className="border-b border-slate-100 dark:border-slate-800 p-5">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-500" /> Desempenho Cruzado (Carro x OS Executadas)
          </h2>
          <p className="text-xs text-slate-400 mt-1 print:hidden">
            Preencha manualmente o número de Ordens de Serviço (OS) executadas por cada veículo/técnico no período para gerar a nota e relatórios de produtividade.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-left text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 print:hidden w-10"></th>
                <th className="px-4 py-3">Veículo / Técnico</th>
                <th className="px-4 py-3 print:w-16 w-32">Nº de OS</th>
                <th className="px-4 py-3 text-right">Custo Total</th>
                <th className="px-4 py-3 text-right">Distância (km)</th>
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
                veiculoStats.map((s) => (
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
                      {/* Em tela exibe input, ao imprimir exibe texto estático */}
                      <span className="hidden print:inline font-bold text-slate-800">{s.os || '0'}</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={osMap[s.veiculoId] ?? ''}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0)
                          setOsMap({ ...osMap, [s.veiculoId]: val })
                        }}
                        className="print:hidden w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-350">{fmtBRL(s.valorTotal)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{s.kmRodadoTotal ? `${fmtNum(s.kmRodadoTotal, 0)} km` : '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-350 font-medium">
                      {s.custoPorOS ? fmtBRL(s.custoPorOS) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                      {s.kmPorOS ? `${s.kmPorOS.toFixed(1)} km/OS` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                      {s.os > 0 ? `${s.osPorLitro.toFixed(3)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.nota === '—' ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          s.nota.startsWith('S')
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETALHAMENTO DE REGISTROS */}
      <div className="print-page-break rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md shadow-sm print:border-none print:shadow-none">
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
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-450">
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
