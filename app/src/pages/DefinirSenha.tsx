import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

// Primeiro acesso (convite) e "esqueci minha senha": o link do e-mail abre esta tela já logado,
// e a pessoa escolhe a própria senha.
export default function DefinirSenha() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [esperou, setEsperou] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setEsperou(true), 4000)
    return () => clearTimeout(t)
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    if (senha !== confirma) return setErro('As duas senhas não são iguais.')
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) setErro(error.message)
    else navigate('/')
  }

  const campo =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-brand-950/40'

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-[#070b13] p-4 transition-colors">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="mb-6 flex flex-col items-center gap-2 text-brand-700 dark:text-brand-400">
          <KeyRound className="h-10 w-10" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center">Criar sua senha</h1>
          {session?.user.email && <p className="text-xs text-slate-500">{session.user.email}</p>}
        </div>
        {!session ? (
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
            {loading || !esperou
              ? 'Conferindo o link…'
              : 'Este link venceu ou já foi usado. Na tela de entrada, clique em "Primeiro acesso ou esqueci a senha" para receber outro.'}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Nova senha</label>
              <input type="password" required autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={campo} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Repita a senha</label>
              <input type="password" required autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} className={campo} />
            </div>
            {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
            <button type="submit" disabled={salvando} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
              {salvando ? 'Salvando…' : 'Salvar e entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
