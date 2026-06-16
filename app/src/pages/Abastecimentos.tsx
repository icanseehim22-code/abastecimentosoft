import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search, Fuel } from 'lucide-react'
import {
  useAbastecimentos, useVeiculos, useMotoristas,
  useUpsertAbastecimento, useDeleteAbastecimento, type FiltrosAbast,
} from '../lib/queries'
import type { Abastecimento, AbastecimentoView } from '../types'
import { fmtBRL, fmtNum, fmtDataBR, hojeISO, COMBUSTIVEIS } from '../lib/format'
import Modal from '../components/ui/Modal'
import { Field, Input, Select, Textarea, btn } from '../components/ui/fields'

const AUTORIZADORES = ['José Paulo', 'Marco Aurelio', 'Hamilton', 'Welton']

type FormAbast = Partial<Abastecimento>

function novo(): FormAbast {
  return { data: hojeISO(), combustivel: 'Gasolina', origem: 'web' }
}

export default function Abastecimentos() {
  const [filtros, setFiltros] = useState<FiltrosAbast>({})
  const { data: lista = [], isLoading } = useAbastecimentos(filtros)
  const { data: veiculos = [] } = useVeiculos()
  const { data: motoristas = [] } = useMotoristas()
  const upsert = useUpsertAbastecimento()
  const del = useDeleteAbastecimento()
  const [edit, setEdit] = useState<FormAbast | null>(null)

  const totais = useMemo(() => ({
    litros: lista.reduce((s, r) => s + Number(r.litros || 0), 0),
    valor: lista.reduce((s, r) => s + Number(r.valor || 0), 0),
  }), [lista])

  function abrirEdicao(r: AbastecimentoView) {
    setEdit({
      id: r.id, data: r.data, veiculo_id: r.veiculo_id, motorista_id: r.motorista_id,
      motorista_nome: r.motorista, combustivel: r.combustivel, km: r.km,
      litros: r.litros, valor: r.valor, autorizado_por: r.autorizado_por,
      observacao: r.observacao, origem: r.origem,
    })
  }

  async function salvar() {
    if (!edit?.veiculo_id || !edit.litros || edit.valor == null || !edit.data) return
    const nomeMot = motoristas.find((m) => m.id === edit.motorista_id)?.nome ?? edit.motorista_nome ?? null
    await upsert.mutateAsync({
      ...edit,
      motorista_nome: nomeMot,
      km: edit.km ? Number(edit.km) : null,
      litros: Number(edit.litros),
      valor: Number(edit.valor),
    })
    setEdit(null)
  }

  async function excluir(r: AbastecimentoView) {
    if (confirm(`Excluir o abastecimento de ${fmtDataBR(r.data)} — ${r.placa}?`)) {
      await del.mutateAsync(r.id)
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Abastecimentos</h1>
        <button className={btn()} onClick={() => setEdit(novo())}>
          <Plus className="h-4 w-4" /> Novo abastecimento
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar motorista, placa, autorização…"
            value={filtros.busca ?? ''} onChange={(e) => setFiltros({ ...filtros, busca: e.target.value || undefined })} />
        </div>
        <Select value={filtros.veiculoId ?? ''} onChange={(e) => setFiltros({ ...filtros, veiculoId: e.target.value || undefined })}>
          <option value="">Todos os veículos</option>
          {veiculos.map((v) => <option key={v.id} value={v.id}>{v.nome} — {v.placa}</option>)}
        </Select>
        <Input type="date" value={filtros.inicio ?? ''} onChange={(e) => setFiltros({ ...filtros, inicio: e.target.value || undefined })} />
        <Input type="date" value={filtros.fim ?? ''} onChange={(e) => setFiltros({ ...filtros, fim: e.target.value || undefined })} />
      </div>

      {/* Totais */}
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-slate-200">{lista.length} registros</span>
        <span className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-slate-200">⛽ {fmtNum(totais.litros)} L</span>
        <span className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-slate-200">💰 {fmtBRL(totais.valor)}</span>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Veículo</th>
              <th className="px-4 py-3">Motorista</th>
              <th className="px-4 py-3">Comb.</th>
              <th className="px-4 py-3 text-right">KM</th>
              <th className="px-4 py-3 text-right">Litros</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">R$/L</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Carregando…</td></tr>
            )}
            {!isLoading && lista.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                <Fuel className="mx-auto mb-2 h-8 w-8" />Nenhum abastecimento encontrado.
              </td></tr>
            )}
            {lista.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-4 py-3">{fmtDataBR(r.data)}</td>
                <td className="px-4 py-3"><div className="font-medium text-slate-800">{r.veiculo_nome}</div><div className="text-xs text-slate-400">{r.placa}</div></td>
                <td className="px-4 py-3">{r.motorista || '—'}</td>
                <td className="px-4 py-3">{r.combustivel}</td>
                <td className="px-4 py-3 text-right">{r.km ? fmtNum(r.km, 0) : '—'}</td>
                <td className="px-4 py-3 text-right">{fmtNum(r.litros)}</td>
                <td className="px-4 py-3 text-right">{fmtBRL(r.valor)}</td>
                <td className="px-4 py-3 text-right text-slate-500">{r.preco_litro ? fmtBRL(r.preco_litro) : '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => abrirEdicao(r)}><Pencil className="h-4 w-4" /></button>
                  <button className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => excluir(r)}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!edit} title={edit?.id ? 'Editar abastecimento' : 'Novo abastecimento'} onClose={() => setEdit(null)}>
        {edit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data">
                <Input type="date" value={edit.data ?? ''} onChange={(e) => setEdit({ ...edit, data: e.target.value })} />
              </Field>
              <Field label="Veículo">
                <Select value={edit.veiculo_id ?? ''} onChange={(e) => {
                  const v = veiculos.find((x) => x.id === e.target.value)
                  setEdit({ ...edit, veiculo_id: e.target.value, combustivel: edit.combustivel || v?.combustivel_padrao || 'Gasolina' })
                }}>
                  <option value="">Selecione…</option>
                  {veiculos.map((v) => <option key={v.id} value={v.id}>{v.nome} — {v.placa}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Motorista">
                <Select value={edit.motorista_id ?? ''} onChange={(e) => setEdit({ ...edit, motorista_id: e.target.value || null })}>
                  <option value="">—</option>
                  {motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </Select>
              </Field>
              <Field label="Combustível">
                <Select value={edit.combustivel ?? 'Gasolina'} onChange={(e) => setEdit({ ...edit, combustivel: e.target.value })}>
                  {COMBUSTIVEIS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="KM">
                <Input type="number" value={edit.km ?? ''} onChange={(e) => setEdit({ ...edit, km: e.target.value ? Number(e.target.value) : null })} />
              </Field>
              <Field label="Litros">
                <Input type="number" step="0.01" value={edit.litros ?? ''} onChange={(e) => setEdit({ ...edit, litros: e.target.value ? Number(e.target.value) : undefined })} />
              </Field>
              <Field label="Valor (R$)">
                <Input type="number" step="0.01" value={edit.valor ?? ''} onChange={(e) => setEdit({ ...edit, valor: e.target.value ? Number(e.target.value) : undefined })} />
              </Field>
            </div>
            <Field label="Autorizado por">
              <Input list="autorizadores" value={edit.autorizado_por ?? ''} onChange={(e) => setEdit({ ...edit, autorizado_por: e.target.value })} />
              <datalist id="autorizadores">{AUTORIZADORES.map((a) => <option key={a} value={a} />)}</datalist>
            </Field>
            <Field label="Observação">
              <Textarea rows={2} value={edit.observacao ?? ''} onChange={(e) => setEdit({ ...edit, observacao: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button className={btn('ghost')} onClick={() => setEdit(null)}>Cancelar</button>
              <button className={btn()} onClick={salvar} disabled={upsert.isPending || !edit.veiculo_id || !edit.litros || edit.valor == null}>
                {upsert.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
