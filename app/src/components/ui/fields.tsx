import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'

const base =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-500 dark:focus:ring-brand-950/40 dark:disabled:bg-slate-800'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">{label}</span>
      {children}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${base} ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${base} ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${base} ${props.className ?? ''}`} />
}

export function btn(variant: 'primary' | 'ghost' | 'danger' = 'primary') {
  const map = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500',
    ghost: 'border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
    danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500',
  }
  return `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${map[variant]}`
}
