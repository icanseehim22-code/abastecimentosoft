import { type LucideIcon } from 'lucide-react'

export default function KpiCard({
  titulo,
  valor,
  icone: Icone,
  cor = 'brand',
  rodape,
}: {
  titulo: string
  valor: string
  icone: LucideIcon
  cor?: 'brand' | 'green' | 'amber' | 'red' | 'slate'
  rodape?: React.ReactNode
}) {
  const cores: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{titulo}</span>
        <span className={`rounded-lg p-1.5 ${cores[cor]}`}>
          <Icone className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-800">{valor}</div>
      {rodape && <div className="mt-1 text-xs text-slate-400">{rodape}</div>}
    </div>
  )
}
