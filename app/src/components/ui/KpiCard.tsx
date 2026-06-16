import { type LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'

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
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/60 dark:backdrop-blur-md"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{titulo}</span>
        <span className={`rounded-lg p-1.5 ${cores[cor]}`}>
          <Icone className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100">{valor}</div>
      {rodape && <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{rodape}</div>}
    </motion.div>
  )
}
