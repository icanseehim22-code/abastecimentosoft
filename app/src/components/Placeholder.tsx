import { Construction } from 'lucide-react'

export default function Placeholder({ title, descricao }: { title: string; descricao?: string }) {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-slate-800">{title}</h1>
      <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-slate-400">
        <Construction className="h-10 w-10" />
        <p className="text-sm">{descricao ?? 'Em construção — chega nas próximas fases.'}</p>
      </div>
    </div>
  )
}
