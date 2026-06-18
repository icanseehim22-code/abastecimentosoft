import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Veiculo, Motorista, Posto, Abastecimento, AbastecimentoView, EficienciaRow, Meta, AlertaView } from '../types'

// ── Veículos ─────────────────────────────────────────────────────────────────
export function useVeiculos(incluirInativos = false) {
  return useQuery({
    queryKey: ['veiculos', incluirInativos],
    queryFn: async (): Promise<Veiculo[]> => {
      let q = supabase.from('veiculos').select('*').order('nome')
      if (!incluirInativos) q = q.eq('ativo', true)
      const { data, error } = await q
      if (error) throw error
      return data as Veiculo[]
    },
  })
}

export function useUpsertVeiculo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: Partial<Veiculo>) => {
      const { error } = await supabase.from('veiculos').upsert(v).select()
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['veiculos'] }),
  })
}

// ── Motoristas ───────────────────────────────────────────────────────────────
export function useMotoristas(incluirInativos = false) {
  return useQuery({
    queryKey: ['motoristas', incluirInativos],
    queryFn: async (): Promise<Motorista[]> => {
      let q = supabase.from('motoristas').select('*').order('nome')
      if (!incluirInativos) q = q.eq('ativo', true)
      const { data, error } = await q
      if (error) throw error
      return data as Motorista[]
    },
  })
}

export function useUpsertMotorista() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (m: Partial<Motorista>) => {
      const { error } = await supabase.from('motoristas').upsert(m).select()
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['motoristas'] }),
  })
}

// ── Abastecimentos ───────────────────────────────────────────────────────────
export interface FiltrosAbast {
  veiculoId?: string
  combustivel?: string
  busca?: string // motorista/placa/autorizado
  inicio?: string // YYYY-MM-DD
  fim?: string
}

export function useAbastecimentos(filtros: FiltrosAbast = {}) {
  return useQuery({
    queryKey: ['abastecimentos', filtros],
    queryFn: async (): Promise<AbastecimentoView[]> => {
      let q = supabase
        .from('vw_abastecimentos')
        .select('*')
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)
      if (filtros.veiculoId) q = q.eq('veiculo_id', filtros.veiculoId)
      if (filtros.combustivel) q = q.eq('combustivel', filtros.combustivel)
      if (filtros.inicio) q = q.gte('data', filtros.inicio)
      if (filtros.fim) q = q.lte('data', filtros.fim)
      if (filtros.busca) {
        const b = `%${filtros.busca}%`
        q = q.or(`motorista.ilike.${b},placa.ilike.${b},autorizado_por.ilike.${b}`)
      }
      const { data, error } = await q
      if (error) throw error
      return data as AbastecimentoView[]
    },
  })
}

export function useUpsertAbastecimento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: Partial<Abastecimento>) => {
      const { error } = await supabase.from('abastecimentos').upsert(a).select()
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['abastecimentos'] })
      qc.invalidateQueries({ queryKey: ['alertas'] })
      qc.invalidateQueries({ queryKey: ['postos'] })
    },
  })
}

/**
 * Lista de postos cadastrados para autocomplete e formulários.
 */
export function usePostos(incluirInativos = false) {
  return useQuery({
    queryKey: ['postos', incluirInativos],
    queryFn: async (): Promise<Posto[]> => {
      let q = supabase.from('postos').select('*').order('nome')
      if (!incluirInativos) q = q.eq('ativo', true)
      const { data, error } = await q
      if (error) throw error
      return data as Posto[]
    },
  })
}

export function useUpsertPosto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: Partial<Posto>) => {
      const { error } = await supabase.from('postos').upsert(p).select()
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['postos'] })
      qc.invalidateQueries({ queryKey: ['abastecimentos'] })
    },
  })
}

// ── Metas ────────────────────────────────────────────────────────────────────
export function useMetas(ano: number, mes: number) {
  return useQuery({
    queryKey: ['metas', ano, mes],
    queryFn: async (): Promise<Meta[]> => {
      const { data, error } = await supabase
        .from('metas').select('*').eq('ano', ano).eq('mes', mes)
      if (error) throw error
      return data as Meta[]
    },
  })
}

export function useUpsertMeta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (m: Partial<Meta>) => {
      const { error } = await supabase
        .from('metas')
        .upsert(m, { onConflict: 'escopo,ref_id,ano,mes' })
        .select()
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['metas'] }),
  })
}

export function useDeleteMeta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('metas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['metas'] }),
  })
}

// ── Alertas (anomalias) ──────────────────────────────────────────────────────
export function useAlertas(apenasNaoResolvidos = false) {
  return useQuery({
    queryKey: ['alertas', apenasNaoResolvidos],
    queryFn: async (): Promise<AlertaView[]> => {
      let q = supabase
        .from('alertas')
        .select('*, veiculo:veiculos(nome,placa), abastecimento:abastecimentos(data,litros,valor,combustivel)')
        .order('created_at', { ascending: false })
        .limit(500)
      if (apenasNaoResolvidos) q = q.eq('resolvido', false)
      const { data, error } = await q
      if (error) throw error
      return data as unknown as AlertaView[]
    },
  })
}

export function useResolverAlerta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, resolvido }: { id: string; resolvido: boolean }) => {
      const { error } = await supabase
        .from('alertas')
        .update({ resolvido, resolvido_em: resolvido ? new Date().toISOString() : null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas'] }),
  })
}

// ── Eficiência (view vw_eficiencia) ──────────────────────────────────────────
export function useEficiencia() {
  return useQuery({
    queryKey: ['eficiencia'],
    queryFn: async (): Promise<EficienciaRow[]> => {
      const { data, error } = await supabase
        .from('vw_eficiencia')
        .select('*')
        .order('data', { ascending: true })
        .limit(2000)
      if (error) throw error
      return data as EficienciaRow[]
    },
  })
}

export function useDeleteAbastecimento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('abastecimentos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['abastecimentos'] }),
  })
}
