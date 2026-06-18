import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Abastecimentos from './pages/Abastecimentos'
import Veiculos from './pages/Veiculos'
import Motoristas from './pages/Motoristas'
import Eficiencia from './pages/Eficiencia'
import Metas from './pages/Metas'
import Alertas from './pages/Alertas'
import AnalisePostos from './pages/AnalisePostos'
import Placeholder from './components/Placeholder'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="abastecimentos" element={<Abastecimentos />} />
        <Route path="veiculos" element={<Veiculos />} />
        <Route path="motoristas" element={<Motoristas />} />
        <Route path="eficiencia" element={<Eficiencia />} />
        <Route path="analise-postos" element={<AnalisePostos />} />
        <Route path="metas" element={<Metas />} />
        <Route path="alertas" element={<Alertas />} />
        <Route path="relatorios" element={<Placeholder title="Relatórios" />} />
        <Route path="config" element={<Placeholder title="Configurações" />} />
      </Route>
    </Routes>
  )
}
