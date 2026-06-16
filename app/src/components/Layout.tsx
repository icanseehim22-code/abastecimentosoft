import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Fuel, Car, Users, Gauge, Target,
  AlertTriangle, FileText, Settings, LogOut,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useAlertas } from '../lib/queries'

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
  const { data: alertas = [] } = useAlertas(true)

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-4 text-brand-700">
          <Fuel className="h-6 w-6" />
          <span className="text-lg font-bold">Gestão Abast.</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="flex-1">{label}</span>
              {label === 'Alertas' && alertas.length > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                  {alertas.length}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <div className="px-2 pb-2 text-sm">
            <div className="font-medium text-slate-800">{profile?.nome ?? '—'}</div>
            <div className="text-xs capitalize text-slate-500">{profile?.papel ?? ''}</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
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
