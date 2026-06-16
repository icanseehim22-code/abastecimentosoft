import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Fuel } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { supabaseConfigured } from '../lib/supabase'
import { motion } from 'framer-motion'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    const { error } = await signIn(email, senha)
    setLoading(false)
    if (error) setErro(error)
    else navigate('/')
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-[#070b13] p-4 transition-colors">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-md dark:border-slate-800/80 dark:bg-slate-900/60 dark:backdrop-blur-md"
      >
        <div className="mb-6 flex flex-col items-center gap-2 text-brand-700 dark:text-brand-400">
          <Fuel className="h-10 w-10 animate-bounce" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center">Gestão de Abastecimento</h1>
        </div>

        {!supabaseConfigured && (
          <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
            Supabase não configurado. Defina <code>VITE_SUPABASE_URL</code> e{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> em <code>app/.env.local</code>.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-brand-950/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Senha</label>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-brand-950/40"
            />
          </div>
          {erro && <p className="text-sm text-red-650 dark:text-red-400">{erro}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
