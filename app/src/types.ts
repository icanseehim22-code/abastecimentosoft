// Tipos do domínio (espelham as tabelas/views do Supabase)

export type Papel = 'admin' | 'gestor' | 'operador'

export interface Profile {
  id: string
  nome: string
  papel: Papel
  telegram_user_id: number | null
  ativo: boolean
  created_at: string
}

export interface Veiculo {
  id: string
  nome: string
  placa: string
  combustivel_padrao: string | null
  capacidade_tanque: number | null
  km_inicial: number | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Motorista {
  id: string
  nome: string
  telefone: string | null
  ativo: boolean
  created_at: string
}

export interface Posto {
  id: string
  nome: string
  cnpj: string | null
  ativo: boolean
  created_at: string
}

export interface Abastecimento {
  id: string
  data: string
  veiculo_id: string
  motorista_id: string | null
  motorista_nome: string | null
  combustivel: string
  km: number | null
  litros: number
  valor: number
  preco_litro: number | null
  posto: string | null
  posto_id: string | null
  autorizado_por: string | null
  observacao: string | null
  origem: 'bot' | 'web'
  criado_por: string | null
  created_at: string
  updated_at: string
}

// view vw_abastecimentos
export interface AbastecimentoView extends Abastecimento {
  veiculo_nome: string
  placa: string
  motorista: string | null
}

export interface Meta {
  id: string
  escopo: 'veiculo' | 'motorista' | 'global'
  ref_id: string | null
  ano: number
  mes: number
  limite_litros: number | null
  limite_valor: number | null
  created_at: string
}

// view vw_eficiencia
export interface EficienciaRow {
  id: string
  veiculo_id: string
  data: string
  km: number | null
  km_anterior: number | null
  km_inicial: number | null
  km_anterior_efetivo: number | null
  litros: number
  valor: number
  combustivel: string
  km_rodado: number | null
  km_por_litro: number | null
  rs_por_km: number | null
}

export interface Alerta {
  id: string
  abastecimento_id: string | null
  veiculo_id: string | null
  tipo: string
  severidade: 'baixa' | 'media' | 'alta'
  mensagem: string
  resolvido: boolean
  resolvido_por: string | null
  resolvido_em: string | null
  created_at: string
}

// alertas com veículo e abastecimento embutidos
export interface AlertaView extends Alerta {
  veiculo: { nome: string; placa: string } | null
  abastecimento: { data: string; litros: number; valor: number; combustivel: string } | null
}
