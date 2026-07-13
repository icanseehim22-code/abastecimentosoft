import { useMemo, useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar, LabelList
} from 'recharts'
import {
  FileText, Printer, Fuel, DollarSign, TrendingUp, TrendingDown, Award,
  MapPin, Zap, Download, Target, AlertTriangle, Check, CalendarDays, Sparkles
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  useAbastecimentos, useEficiencia, useVeiculos, useMotoristas, useMetas
} from '../lib/queries'
import { supabase } from '../lib/supabase'
import { fmtBRL, fmtNum } from '../lib/format'
import { Select, Input } from '../components/ui/fields'
import { useChartTheme, ChartTooltip, CHART_COLORS, tickBRLk } from '../components/ui/charts'

const CORES_PIE = ['#3b62f0', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

export default function Relatorios() {
  const [isPrinting, setIsPrinting] = useState(false)
  const ct = useChartTheme()

  useEffect(() => {
    const handleBeforePrint = () => {
      flushSync(() => {
        setIsPrinting(true)
      })
    }
    const handleAfterPrint = () => {
      flushSync(() => {
        setIsPrinting(false)
      })
    }

    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [])

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

  // Mês anterior para comparativo semanal
  const { inicioMesAnterior, fimMesAnterior, labelMesAtual, labelMesAnterior } = useMemo(() => {
    // filtros.inicio está no formato 'YYYY-MM-DD'
    const partes = filtros.inicio.split('-').map(Number)
    const ano = partes[0]
    const mes = partes[1] - 1 // Converter para 0-based index para bater com nomesMes
    
    // Mes anterior
    const dataAnterior = new Date(ano, mes - 1, 1)
    const ultimoDiaAnterior = new Date(ano, mes, 0)
    
    const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return {
      inicioMesAnterior: `${dataAnterior.getFullYear()}-${String(dataAnterior.getMonth() + 1).padStart(2,'0')}-01`,
      fimMesAnterior: `${ultimoDiaAnterior.getFullYear()}-${String(ultimoDiaAnterior.getMonth() + 1).padStart(2,'0')}-${String(ultimoDiaAnterior.getDate()).padStart(2,'0')}`,
      labelMesAtual: `${nomesMes[mes]}/${String(ano).slice(2)}`,
      labelMesAnterior: `${nomesMes[dataAnterior.getMonth()]}/${String(dataAnterior.getFullYear()).slice(2)}`,
    }
  }, [filtros.inicio])

  const { data: abastecimentosMesAnterior = [] } = useAbastecimentos({
    inicio: inicioMesAnterior,
    fim: fimMesAnterior,
    veiculoId: filtros.veiculoId,
    combustivel: filtros.combustivel
  })

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

  // PERSISTÊNCIA DE OS: Carrega/Salva no Supabase (com fallback local no localStorage)
  const [osMap, setOsMap] = useState<Record<string, number>>({})

  useEffect(() => {
    let active = true

    async function carregarOS() {
      // Primeiro carrega o que estiver no localStorage como fallback rápido
      const localKey = `os_map_${filtros.inicio}_${filtros.fim}`
      const savedLocal = localStorage.getItem(localKey)
      if (savedLocal) {
        try {
          setOsMap(JSON.parse(savedLocal))
        } catch {
          // ignore
        }
      } else {
        setOsMap({})
      }

      // Em seguida, busca no Supabase
      try {
        const { data, error } = await supabase
          .from('veiculo_os')
          .select('veiculo_id, quantidade')
          .eq('periodo_inicio', filtros.inicio)
          .eq('periodo_fim', filtros.fim)

        if (error) {
          console.error('Erro ao buscar OS do Supabase:', error)
          return
        }

        if (data && active) {
          const newMap: Record<string, number> = {}
          data.forEach((row) => {
            newMap[row.veiculo_id] = row.quantidade
          })
          setOsMap(newMap)
          // Atualiza o local storage para manter sincronizado offline/fallback
          localStorage.setItem(localKey, JSON.stringify(newMap))
        }
      } catch (err) {
        console.error('Erro na requisição de OS:', err)
      }
    }

    carregarOS()

    return () => {
      active = false
    }
  }, [filtros.inicio, filtros.fim])

  const salvarOS = async (veiculoId: string, val: number) => {
    // 1. Atualização otimista no estado local e localStorage
    const newMap = { ...osMap, [veiculoId]: val }
    setOsMap(newMap)

    const localKey = `os_map_${filtros.inicio}_${filtros.fim}`
    localStorage.setItem(localKey, JSON.stringify(newMap))

    // 2. Persistência assíncrona no Supabase
    try {
      const { error } = await supabase
        .from('veiculo_os')
        .upsert({
          veiculo_id: veiculoId,
          periodo_inicio: filtros.inicio,
          periodo_fim: filtros.fim,
          quantidade: val,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'veiculo_id,periodo_inicio,periodo_fim'
        })

      if (error) {
        console.error('Erro ao salvar OS no Supabase:', error)
      }
    } catch (err) {
      console.error('Erro ao enviar OS ao banco:', err)
    }
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
      motoristas: Map<string, number>
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
          incluido,
          motoristas: new Map()
        }
      }

      const s = stats[vId]
      s.valorTotal += Number(r.valor)
      s.litrosTotal += Number(r.litros)
      s.count += 1

      const mot = r.motorista?.trim() || ''
      if (mot) s.motoristas.set(mot, (s.motoristas.get(mot) || 0) + 1)

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

      let motoristaPrincipal = '—'
      let maxC = 0
      for (const [m, c] of item.motoristas.entries()) {
        if (c > maxC) { maxC = c; motoristaPrincipal = m }
      }
      const partes = motoristaPrincipal.split(' ')
      const nomeAbrev = partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : motoristaPrincipal

      return {
        ...item,
        os,
        custoPorOS,
        kmPorOS,
        osPorLitro,
        nota,
        motoristaPrincipal: nomeAbrev
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
  
  // Cálculo de Manutenção Preventiva de 10k em 10k
  const dadosManutencao = useMemo(() => {
    // 1. Obter o último KM conhecido de cada veículo (a partir do banco global, ordenando os abastecimentos históricos)
    // Para estimar o consumo diário, pegamos a diferença entre o primeiro e o último abastecimento de cada veículo
    const kmsPorVeiculo: Record<string, { kms: number[]; datas: string[] }> = {}
    
    // Agrupa dados históricos por veículo
    for (const r of abastecimentosRaw) {
      if (r.km && r.km > 0) {
        if (!kmsPorVeiculo[r.veiculo_id]) kmsPorVeiculo[r.veiculo_id] = { kms: [], datas: [] }
        kmsPorVeiculo[r.veiculo_id].kms.push(r.km)
        kmsPorVeiculo[r.veiculo_id].datas.push(r.data)
      }
    }
    
    return veiculos.map((v) => {
      const vKms = kmsPorVeiculo[v.id]
      let kmAtual = v.km_inicial ?? 0
      let kmMaisAntigo = v.km_inicial ?? 0
      let dataMaisAntiga = v.created_at ? v.created_at.split('T')[0] : ''
      let dataAtual = new Date().toISOString().split('T')[0]
      
      if (vKms && vKms.kms.length > 0) {
        // Encontra o maior km (atual) e o menor km
        const sortedIndices = vKms.kms.map((_, i) => i).sort((a, b) => new Date(vKms.datas[a]).getTime() - new Date(vKms.datas[b]).getTime())
        const indexPrimeiro = sortedIndices[0]
        const indexUltimo = sortedIndices[sortedIndices.length - 1]
        
        kmAtual = vKms.kms[indexUltimo]
        dataAtual = vKms.datas[indexUltimo]
        
        kmMaisAntigo = vKms.kms[indexPrimeiro]
        dataMaisAntiga = vKms.datas[indexPrimeiro]
      }
      
      // Proxima revisão (multiplo de 10.000)
      const proximaRevisao = Math.ceil((kmAtual + 1) / 10000) * 10000
      const kmRestante = Math.max(0, proximaRevisao - kmAtual)
      
      // Estimar rodagem diária média
      let kmDiarioMedio = 30 // Fallback padrão de 30km/dia
      if (kmAtual > kmMaisAntigo && dataMaisAntiga && dataAtual !== dataMaisAntiga) {
        const diffTime = Math.abs(new Date(dataAtual).getTime() - new Date(dataMaisAntiga).getTime())
        const dias = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
        kmDiarioMedio = Math.max(5, (kmAtual - kmMaisAntigo) / dias)
      }
      
      // Estimar data da próxima revisão
      const diasAteRevisao = kmDiarioMedio > 0 ? kmRestante / kmDiarioMedio : 365
      const dataRevisaoPrevista = new Date()
      dataRevisaoPrevista.setDate(dataRevisaoPrevista.getDate() + diasAteRevisao)
      
      return {
        id: v.id,
        nome: v.nome,
        placa: v.placa,
        kmAtual,
        proximaRevisao,
        kmRestante,
        previsaoData: kmRestante === 0 ? 'Excedida!' : dataRevisaoPrevista.toLocaleDateString('pt-BR'),
        status: kmRestante <= 1000 ? 'urgente' : kmRestante <= 2500 ? 'alerta' : 'ok',
        incluido: !excluidos[v.id]
      }
    }).filter(item => item.incluido && item.kmAtual > 0).sort((a, b) => a.kmRestante - b.kmRestante)
  }, [veiculos, abastecimentosRaw, excluidos])

  // Gráfico: Top veículos por gasto (apenas incluídos)
  const topVeiculos = useMemo(() => {
    return veiculoStats
      .filter((v) => v.incluido)
      .slice(0, 8)
      .map((v) => ({ nome: v.nome, valor: v.valorTotal, motoristaPrincipal: v.motoristaPrincipal }))
  }, [veiculoStats])

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

  // Comparativo semanal: mês atual vs mês anterior
  const comparativoSemanal = useMemo(() => {
    function semanaDoMes(dataStr: string): number {
      // dataStr está no formato 'YYYY-MM-DD'
      const dia = Number(dataStr.split('-')[2])
      return Math.min(3, Math.floor((dia - 1) / 7)) // 0–3 → Sem 1–Sem 4
    }

    const semanas = [0, 1, 2, 3]
    const labelSemanas = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4']

    const atual: Record<number, { gasto: number; litros: number }> = { 0: {gasto:0,litros:0}, 1: {gasto:0,litros:0}, 2: {gasto:0,litros:0}, 3: {gasto:0,litros:0}, 4: {gasto:0,litros:0} }
    const anterior: Record<number, { gasto: number; litros: number }> = { 0: {gasto:0,litros:0}, 1: {gasto:0,litros:0}, 2: {gasto:0,litros:0}, 3: {gasto:0,litros:0}, 4: {gasto:0,litros:0} }

    for (const r of abastecimentos) {
      if (excluidos[r.veiculo_id]) continue
      const s = Math.min(3, semanaDoMes(r.data))
      atual[s].gasto += Number(r.valor)
      atual[s].litros += Number(r.litros)
    }
    for (const r of abastecimentosMesAnterior) {
      const s = Math.min(3, semanaDoMes(r.data))
      anterior[s].gasto += Number(r.valor)
      anterior[s].litros += Number(r.litros)
    }

    return semanas.map((s) => ({
      semana: labelSemanas[s],
      [`gasto_${labelMesAtual}`]: atual[s].gasto,
      [`gasto_${labelMesAnterior}`]: anterior[s].gasto,
      [`litros_${labelMesAtual}`]: atual[s].litros,
      [`litros_${labelMesAnterior}`]: anterior[s].litros,
      deltaGasto: anterior[s].gasto > 0 ? ((atual[s].gasto - anterior[s].gasto) / anterior[s].gasto) * 100 : null,
    }))
  }, [abastecimentos, abastecimentosMesAnterior, excluidos, labelMesAtual, labelMesAnterior])

  // Totais para o cabeçalho do comparativo
  const totaisComparativo = useMemo(() => {
    const gastoAtual = comparativoSemanal.reduce((s, r) => s + (r[`gasto_${labelMesAtual}`] as number), 0)
    const gastoAnterior = comparativoSemanal.reduce((s, r) => s + (r[`gasto_${labelMesAnterior}`] as number), 0)
    const litrosAtual = comparativoSemanal.reduce((s, r) => s + (r[`litros_${labelMesAtual}`] as number), 0)
    const litrosAnterior = comparativoSemanal.reduce((s, r) => s + (r[`litros_${labelMesAnterior}`] as number), 0)
    const deltaGasto = gastoAnterior > 0 ? ((gastoAtual - gastoAnterior) / gastoAnterior) * 100 : null
    const deltaLitros = litrosAnterior > 0 ? ((litrosAtual - litrosAnterior) / litrosAnterior) * 100 : null
    return { gastoAtual, gastoAnterior, litrosAtual, litrosAnterior, deltaGasto, deltaLitros }
  }, [comparativoSemanal, labelMesAtual, labelMesAnterior])

  // Comparativo de preço médio de combustível (todos postos juntos) por tipo
  const comparativoPrecosCombustivel = useMemo(() => {
    const combustiveis = ['Etanol', 'Gasolina', 'Diesel', 'GNV']
    
    const atualAcum: Record<string, { valor: number; litros: number }> = {}
    const anteriorAcum: Record<string, { valor: number; litros: number }> = {}
    
    combustiveis.forEach(c => {
      atualAcum[c] = { valor: 0, litros: 0 }
      anteriorAcum[c] = { valor: 0, litros: 0 }
    })
    
    for (const r of abastecimentos) {
      if (excluidos[r.veiculo_id]) continue
      const c = r.combustivel
      if (atualAcum[c]) {
        atualAcum[c].valor += Number(r.valor)
        atualAcum[c].litros += Number(r.litros)
      }
    }
    
    for (const r of abastecimentosMesAnterior) {
      const c = r.combustivel
      if (anteriorAcum[c]) {
        anteriorAcum[c].valor += Number(r.valor)
        anteriorAcum[c].litros += Number(r.litros)
      }
    }
    
    return combustiveis.map(c => {
      const pAtual = atualAcum[c].litros > 0 ? atualAcum[c].valor / atualAcum[c].litros : null
      const pAnterior = anteriorAcum[c].litros > 0 ? anteriorAcum[c].valor / anteriorAcum[c].litros : null
      const delta = pAnterior && pAtual ? ((pAtual - pAnterior) / pAnterior) * 100 : null
      
      return {
        combustivel: c,
        precoAtual: pAtual,
        precoAnterior: pAnterior,
        delta
      }
    }).filter(item => item.precoAtual !== null || item.precoAnterior !== null)
  }, [abastecimentos, abastecimentosMesAnterior, excluidos])

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
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-page-break {
            break-before: page !important;
            page-break-before: always !important;
            margin-top: 0 !important;
            padding-top: 2rem !important;
          }
          table {
            width: 100% !important;
            font-size: 10px !important;
          }
          th, td {
            padding: 4px 6px !important;
          }
          .print-grid-2 {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 1.5rem !important;
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
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
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
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
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
              <p className="text-sm text-slate-600 dark:text-slate-300">
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
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
            Metas do Mês ({parsedPeriod.month}/{parsedPeriod.year})
          </h2>
          <div className="mt-3 space-y-2 flex-1 max-h-32 overflow-y-auto">
            {metas.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">Nenhuma meta específica cadastrada no Supabase para este mês.</div>
            ) : (
              metas.map((m) => (
                <div key={m.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 dark:border-slate-800/30">
                  <span className="text-slate-600 dark:text-slate-400 capitalize">
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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5 print:grid-cols-5 print:gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase">Custo Total</span>
            <DollarSign className="h-4 w-4 text-brand-500" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{fmtBRL(kpis.totalGasto)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase">Volume Total</span>
            <Fuel className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{fmtNum(kpis.totalLitros)} L</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase">Distância</span>
            <MapPin className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{fmtNum(kpis.totalKmRodado, 0)} km</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase">Média Geral</span>
            <Zap className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {kpis.kmPorLitroMedio ? `${kpis.kmPorLitroMedio.toFixed(2)} km/l` : '—'}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase">Custo por KM</span>
            <TrendingUp className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {kpis.custoPorKm ? fmtBRL(kpis.custoPorKm) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* COMPARATIVO SEMANAL: MÊS ATUAL vs MÊS ANTERIOR */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm print-avoid-break">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-brand-500" /> Comparativo Semanal — {labelMesAtual} vs {labelMesAnterior}
          </h2>
          {/* Mini KPIs de delta */}
          <div className="flex flex-wrap gap-3">
            {/* Delta Gasto */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Gasto total</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{fmtBRL(totaisComparativo.gastoAtual)}</span>
              {totaisComparativo.deltaGasto !== null && (
                <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  totaisComparativo.deltaGasto > 0
                    ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                }`}>
                  {totaisComparativo.deltaGasto > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(totaisComparativo.deltaGasto).toFixed(1)}%
                </span>
              )}
            </div>
            {/* Delta Litros */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Volume total</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{fmtNum(totaisComparativo.litrosAtual)} L</span>
              {totaisComparativo.deltaLitros !== null && (
                <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  totaisComparativo.deltaLitros > 0
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                }`}>
                  {totaisComparativo.deltaLitros > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(totaisComparativo.deltaLitros).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 print-grid-2">
          {/* Gráfico de Gastos por Semana */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Gasto (R$) por semana</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={comparativoSemanal} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={ct.grid} />
                <XAxis dataKey="semana" tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} tickFormatter={tickBRLk} />
                <Tooltip content={<ChartTooltip formatter={(v) => fmtBRL(v)} />} />
                <Bar dataKey={`gasto_${labelMesAnterior}`} name={labelMesAnterior} fill="#94a3b8" radius={[4,4,0,0]} maxBarSize={22} isAnimationActive={!isPrinting} />
                <Bar dataKey={`gasto_${labelMesAtual}`} name={labelMesAtual} fill="#3b62f0" radius={[4,4,0,0]} maxBarSize={22} isAnimationActive={!isPrinting} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Litros por Semana */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Volume (L) por semana</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={comparativoSemanal} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={ct.grid} />
                <XAxis dataKey="semana" tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip formatter={(v) => `${fmtNum(v)} L`} />} />
                <Bar dataKey={`litros_${labelMesAnterior}`} name={labelMesAnterior} fill="#94a3b8" radius={[4,4,0,0]} maxBarSize={22} isAnimationActive={!isPrinting} />
                <Bar dataKey={`litros_${labelMesAtual}`} name={labelMesAtual} fill="#10b981" radius={[4,4,0,0]} maxBarSize={22} isAnimationActive={!isPrinting} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabela de detalhes por semana */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="py-2 text-left text-xs font-semibold text-slate-400 uppercase">Semana</th>
                <th className="py-2 text-right text-xs font-semibold text-slate-400 uppercase">Gasto {labelMesAnterior}</th>
                <th className="py-2 text-right text-xs font-semibold text-slate-400 uppercase">Gasto {labelMesAtual}</th>
                <th className="py-2 text-right text-xs font-semibold text-slate-400 uppercase">Variação</th>
                <th className="py-2 text-right text-xs font-semibold text-slate-400 uppercase">Litros {labelMesAnterior}</th>
                <th className="py-2 text-right text-xs font-semibold text-slate-400 uppercase">Litros {labelMesAtual}</th>
              </tr>
            </thead>
            <tbody>
              {comparativoSemanal.map((row) => {
                const ga = row[`gasto_${labelMesAnterior}`] as number
                const gc = row[`gasto_${labelMesAtual}`] as number
                const la = row[`litros_${labelMesAnterior}`] as number
                const lc = row[`litros_${labelMesAtual}`] as number
                const delta = ga > 0 ? ((gc - ga) / ga) * 100 : null
                const subiu = delta !== null && delta > 0
                return (
                  <tr key={row.semana} className="border-b border-slate-50 dark:border-slate-800/40 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition">
                    <td className="py-2.5 font-semibold text-slate-700 dark:text-slate-200">{row.semana}</td>
                    <td className="py-2.5 text-right text-slate-500 dark:text-slate-400">{ga > 0 ? fmtBRL(ga) : '—'}</td>
                    <td className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">{gc > 0 ? fmtBRL(gc) : '—'}</td>
                    <td className="py-2.5 text-right">
                      {delta !== null ? (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                          subiu ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {subiu ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {subiu ? '+' : ''}{delta.toFixed(1)}%
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-2.5 text-right text-slate-500 dark:text-slate-400">{la > 0 ? `${fmtNum(la)} L` : '—'}</td>
                    <td className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">{lc > 0 ? `${fmtNum(lc)} L` : '—'}</td>
                  </tr>
                )
              })}
              {/* Linha de totais */}
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/30">
                <td className="py-2.5 font-bold text-slate-700 dark:text-slate-200">Total</td>
                <td className="py-2.5 text-right font-bold text-slate-600 dark:text-slate-300">{fmtBRL(totaisComparativo.gastoAnterior)}</td>
                <td className="py-2.5 text-right font-bold text-slate-800 dark:text-slate-100">{fmtBRL(totaisComparativo.gastoAtual)}</td>
                <td className="py-2.5 text-right">
                  {totaisComparativo.deltaGasto !== null && (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                      totaisComparativo.deltaGasto > 0 ? 'text-red-500' : 'text-emerald-600'
                    }`}>
                      {totaisComparativo.deltaGasto > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {totaisComparativo.deltaGasto > 0 ? '+' : ''}{totaisComparativo.deltaGasto.toFixed(1)}%
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-right font-bold text-slate-600 dark:text-slate-300">{fmtNum(totaisComparativo.litrosAnterior)} L</td>
                <td className="py-2.5 text-right font-bold text-slate-800 dark:text-slate-100">{fmtNum(totaisComparativo.litrosAtual)} L</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* COMPARATIVO DE PREÇO MÉDIO POR COMBUSTÍVEL */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm print-avoid-break">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <Fuel className="h-4 w-4 text-emerald-500" /> Comparativo de Preço Médio (R$/L) — {labelMesAtual} vs {labelMesAnterior}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {comparativoPrecosCombustivel.map((item) => {
            const subiu = item.delta !== null && item.delta > 0
            return (
              <div key={item.combustivel} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
                <div className="text-xs font-semibold text-slate-400 uppercase mb-1">{item.combustivel}</div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {item.precoAtual ? `${fmtBRL(item.precoAtual)}/L` : '—'}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xxs font-semibold">
                  <span className="text-slate-450 dark:text-slate-500">Ant: {item.precoAnterior ? fmtBRL(item.precoAnterior) : '—'}</span>
                  {item.delta !== null && (
                    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-bold ${
                      subiu ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-450' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-450'
                    }`}>
                      {subiu ? '▲' : '▼'} {Math.abs(item.delta).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {comparativoPrecosCombustivel.length === 0 && (
            <div className="col-span-4 text-center text-xs text-slate-400 py-4">Sem dados de combustível para comparar no período.</div>
          )}
        </div>
      </div>

      {/* QUADRO DE INSIGHTS EXECUTIVOS */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-brand-500/5 to-indigo-500/5 p-5 dark:border-slate-800/80 dark:bg-slate-900/20">
        <h2 className="text-sm font-bold text-brand-800 dark:text-brand-400 uppercase tracking-wider flex items-center gap-2 mb-3">
          <Award className="h-4.5 w-4.5" /> Insights da Diretoria
        </h2>
        <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          {insights.map((ins, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"></span>
              <span dangerouslySetInnerHTML={{ __html: ins.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </li>
          ))}
        </ul>
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 print:grid-cols-2 print:gap-4">
        {/* Distribuição por Combustível */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm flex flex-col min-w-0 overflow-hidden">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Gastos por Combustível</h3>
          <div className="relative w-full h-48 flex items-center justify-center">
            {dadosCombustivel.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">Sem dados</div>
            ) : (
              <>
                <ResponsiveContainer width={isPrinting ? 260 : "99%"} height={192}>
                  <PieChart>
                    <Pie
                      data={dadosCombustivel}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                      isAnimationActive={!isPrinting}
                    >
                      {dadosCombustivel.map((entry, idx) => (
                        <Cell key={entry.name} fill={CORES_PIE[idx % CORES_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip hideLabel formatter={(v, n) => `${n}: ${fmtBRL(v)}`} />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 -mt-6 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total</span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-100">{fmtBRL(kpis.totalGasto)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Evolução de Gastos */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm flex flex-col min-w-0 overflow-hidden">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Histórico de Gastos</h3>
          <div className="w-full h-48 flex items-center justify-center">
            {dadosEvolucao.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">Sem dados</div>
            ) : (
              <ResponsiveContainer width={isPrinting ? 260 : "99%"} height={192}>
                <AreaChart data={dadosEvolucao} margin={{ top: 5, right: 25, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b62f0" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#3b62f0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={ct.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} tickFormatter={tickBRLk} />
                  <Tooltip content={<ChartTooltip formatter={(v) => fmtBRL(v)} />} />
                  <Area type="monotone" dataKey="valor" stroke="#3b62f0" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValor)" dot={{ r: 2.5, fill: '#3b62f0' }} activeDot={{ r: 5 }} isAnimationActive={!isPrinting} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Top veículos por gasto */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm print-avoid-break">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Ranking de Gasto por Veículo</h3>
        {topVeiculos.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-slate-400">Sem dados</div>
        ) : (
          <ResponsiveContainer width={isPrinting ? 520 : "99%"} height={Math.max(260, topVeiculos.length * 46)}>
            <BarChart data={topVeiculos} layout="vertical" margin={{ left: 16, right: 64 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} tickFormatter={tickBRLk} />
              <YAxis
                type="category"
                dataKey="nome"
                width={110}
                axisLine={false}
                tickLine={false}
                tick={(props: any) => {
                  const { x, y, payload } = props
                  const item = topVeiculos.find(v => v.nome === payload.value)
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text x={-4} y={-5} textAnchor="end" fill={ct.axis} fontSize={11} fontWeight={600}>{payload.value}</text>
                      <text x={-4} y={9} textAnchor="end" fill={ct.axis} fontSize={10} opacity={0.6}>{item?.motoristaPrincipal ?? '—'}</text>
                    </g>
                  )
                }}
              />
              <Tooltip cursor={ct.cursor} content={<ChartTooltip hideLabel formatter={(v) => fmtBRL(v)} />} />
              <Bar dataKey="valor" radius={[0, 6, 6, 0]} maxBarSize={26} isAnimationActive={!isPrinting}>
                {topVeiculos.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                <LabelList dataKey="valor" position="right" formatter={(v: any) => fmtBRL(Number(v))} style={{ fontSize: 11, fill: ct.axis, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
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
                        <div className="text-xs text-slate-400 dark:text-slate-500">{s.placa} • Principal: {s.motoristaPrincipal}</div>
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
                      <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">{fmtBRL(s.valorTotal)}</td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300 font-medium">
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
      <div className="print-page-break rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md shadow-sm print:border-none print:shadow-none">
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
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{m.nome}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{m.abastecimentosCount}x</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{fmtNum(m.litrosValidos)} L</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{fmtNum(m.kmValidos, 0)} km</td>
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

      {/* SEÇÃO MANUTENÇÃO PREVENTIVA */}
      <div className="print-page-break rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:backdrop-blur-md shadow-sm print:border-none print:shadow-none">
        <div className="border-b border-slate-100 dark:border-slate-800 p-5">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Controle de Manutenção Preventiva (Revisão 10.000 km)
          </h2>
          <p className="text-xs text-slate-400 mt-1">Acompanhamento automático das próximas revisões com previsão baseada no uso diário histórico da frota.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-left text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3 text-right">KM Atual</th>
                <th className="px-4 py-3 text-right">Próxima Revisão</th>
                <th className="px-4 py-3 text-right">Faltam (km)</th>
                <th className="px-4 py-3 text-center">Previsão Realização</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {dadosManutencao.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">Sem dados de hodômetro válidos no período.</td></tr>
              ) : (
                dadosManutencao.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{item.nome}</div>
                      <div className="text-xxs text-slate-400 dark:text-slate-500">{item.placa}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">{fmtNum(item.kmAtual, 0)} km</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-850 dark:text-slate-100">{fmtNum(item.proximaRevisao, 0)} km</td>
                    <td className="px-4 py-3 text-right">
                      <span className={item.status === 'urgente' ? 'text-rose-600 font-bold' : item.status === 'alerta' ? 'text-amber-600 font-semibold' : 'text-slate-500'}>
                        {fmtNum(item.kmRestante, 0)} km
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-350 font-medium">
                      {item.previsaoData}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xxs font-bold uppercase ${
                        item.status === 'urgente'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 animate-pulse'
                          : item.status === 'alerta'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      }`}>
                        {item.status === 'urgente' ? 'Urgente' : item.status === 'alerta' ? 'Próximo' : 'Em Dia'}
                      </span>
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
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatarDataBR(r.data)}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{r.veiculo_nome}</span>
                          <span className="block text-xxs text-slate-400 dark:text-slate-500">{r.placa}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{r.motorista || '—'}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{r.posto || '—'}</td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{fmtNum(r.litros)}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">{fmtBRL(r.valor)}</td>
                        <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">{r.preco_litro ? fmtBRL(r.preco_litro) : '—'}</td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
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
            <div className="font-bold text-slate-800">Gestor de Frota</div>
            <div className="text-slate-400 mt-1">Jose Paulo</div>
          </div>
          <div>
            <div className="border-t border-slate-400 w-64 mx-auto pt-2"></div>
            <div className="font-bold text-slate-800">Diretor Responsável</div>
            <div className="text-slate-400 mt-1">Marco Aurélio</div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
