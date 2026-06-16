// Helpers de agregação para dashboards

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// 'YYYY-MM-DD' -> 'YYYY-MM'
export function ymKey(iso: string): string {
  return iso.slice(0, 7)
}

// 'YYYY-MM' -> 'jun/26'
export function ymLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MESES[Number(m) - 1]}/${y.slice(2)}`
}

export function ymAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Soma/desloca meses sobre uma chave 'YYYY-MM'
export function ymShift(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Lista dos últimos n meses (incluindo o atual), em ordem cronológica
export function ultimosMeses(n: number): string[] {
  const out: string[] = []
  let ym = ymAtual()
  for (let i = 0; i < n; i++) {
    out.unshift(ym)
    ym = ymShift(ym, -1)
  }
  return out
}

export function soma<T>(arr: T[], fn: (x: T) => number): number {
  return arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0)
}
