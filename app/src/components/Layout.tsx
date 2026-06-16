import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Fuel, Car, Users, Gauge, Target,
  AlertTriangle, FileText, Settings, LogOut, Sun, Moon
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useAlertas } from '../lib/queries'
import { useTheme } from '../context/ThemeContext'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/abastecimentos', label: 'Abastecimentos', icon: Fuel },
  { to: '/veiculos', label: 'Veículos', icon: Car },
  { to: '/motoristas', label: 'Motoristas', icon: Users },
  { to: '/eficiencia', label: 'Eficiência', icon: Gauge },
  { to: '/metas', label: 'Custos & Metas', icon: Target },
  { to: '/alertas', label: 'Alertas', icon: AlertTriangle },
  { to: '/relatorios', label: 'Relatórios', icon: FileText },
  { to: '/config', label: 'Configurações', icon: Settings },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { data: alertas = [] } = useAlertas(true)

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-full bg-slate-50 text-slate-800 dark:bg-[#070b13] dark:text-slate-200 transition-colors duration-200">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-800/80 dark:bg-slate-900/60 dark:backdrop-blur-md">
        <div className="flex items-center gap-2 px-5 py-4 text-brand-700 dark:text-brand-400">
          <Fuel className="h-6 w-6 animate-pulse" />
          <span className="text-lg font-bold bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent dark:from-brand-400 dark:to-brand-300">
            Gestão Abast.
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition duration-200 ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="flex-1">{label}</span>
              {label === 'Alertas' && alertas.length > 0 && (
                <span className="relative flex h-5 items-center justify-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/80 dark:text-rose-400">
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  {alertas.length}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 dark:border-slate-800 p-3">
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="text-sm min-w-0">
              <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{profile?.nome ?? '—'}</div>
              <div className="text-xs capitalize text-slate-500 dark:text-slate-400 truncate">{profile?.papel ?? ''}</div>
            </div>
            <button
              onClick={toggleTheme}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
              title="Alternar Tema"
            >
              {theme === 'dark' ? <Sun className="h-4.5 w-4.5 text-amber-500" /> : <Moon className="h-4.5 w-4.5" />}
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200 transition"
          >
            <LogOut className="h-[18px] w-[18px]" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
