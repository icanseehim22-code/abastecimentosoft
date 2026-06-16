// Helpers de formatação (pt-BR)

export function fmtBRL(v: number | null | undefined): string {
  if (v == null || isNaN(Number(v))) return '—'
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function fmtNum(v: number | null | undefined, dec = 2): string {
  if (v == null || isNaN(Number(v))) return '—'
  return Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

// 'YYYY-MM-DD' (ou ISO) -> 'DD/MM/YYYY'
export function fmtDataBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = iso.slice(0, 10).split('-')
  if (d.length !== 3) return iso
  return `${d[2]}/${d[1]}/${d[0]}`
}

// Date -> 'YYYY-MM-DD'
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function hojeISO(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export const COMBUSTIVEIS = ['Gasolina', 'Etanol', 'Diesel', 'GNV'] as const
