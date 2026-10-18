import { useCallback, useRef, useState, type DragEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileUp, Loader2, Trash2, CheckCircle2, AlertTriangle, ZoomIn } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useVeiculos, useMotoristas, usePostos } from '../lib/queries'
import { fmtBRL, COMBUSTIVEIS } from '../lib/format'
import { btn } from '../components/ui/fields'

// Importar notas (18/10/2026): várias fotos de NFC-e / comprovante de uma vez. O painel lê cada foto
// (QR code da NFC-e na SEFAZ ou OCR local), a pessoa confere a tabela e lança tudo de uma vez.
// Nota escrita à mão o OCR quase não lê: a foto fica grande ao lado para digitar o que faltar.

type Lida = {
  ok: boolean; erro?: string; fonte?: 'nfce' | 'ocr'; data?: string; hora?: string; litros?: number; valor?: number
  combustivel?: string; posto?: string; cnpj?: string; placa?: string; km?: number; chave?: string; avisos?: string[]
  veiculo_id?: string | null; km_sugerido?: number | null; km_como?: string | null; duplicado?: string | null
}
type Linha = {
  id: number; arquivo: File; foto: string; estado: 'lendo' | 'pronta' | 'erro' | 'lancada'
  lida?: Lida; erro?: string
  data: string; veiculo_id: string; motorista_id: string; combustivel: string; km: string; litros: string; valor: string
  posto_id: string; posto: string; incluir: boolean
}

const API = '/api/mapa/abast'
const base = 'w-full rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
const num = (s: string) => (s === '' || s == null ? null : Number(String(s).replace(/\./g, '').replace(',', '.')))
const numBR = (v?: number | null, d = 2) => (v == null ? '' : v.toFixed(d).replace('.', ','))
const combBase = (c?: string) => (c ? (COMBUSTIVEIS as readonly string[]).find((x) => c.toLowerCase().startsWith(x.toLowerCase())) ?? 'Gasolina' : '')

export default function ImportarNotas() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const { data: veiculos = [] } = useVeiculos()
  const { data: motoristas = [] } = useMotoristas()
  const { data: postos = [] } = usePostos()
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [zoom, setZoom] = useState<string | null>(null)
  const [lancando, setLancando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const seq = useRef(0)
  const entrada = useRef<HTMLInputElement>(null)

  const muda = (id: number, p: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)))

  async function ler(l: Linha) {
    try {
      const r = await fetch(`${API}/ler`, { method: 'POST', body: l.arquivo, headers: { 'x-nome': encodeURIComponent(l.arquivo.name) } })
      const d: Lida = await r.json()
      if (!d.ok) return muda(l.id, { estado: 'erro', erro: d.erro || 'não li a foto' })
      const v = veiculos.find((x) => x.id === d.veiculo_id)
      const p = postos.find((x) => (d.cnpj && x.cnpj && x.cnpj.replace(/\D/g, '') === d.cnpj) ||
        (d.posto && x.nome.toLowerCase().split(' ').filter((w) => w.length > 3).some((w) => d.posto!.toLowerCase().includes(w))))
      muda(l.id, {
        estado: 'pronta', lida: d, data: d.data || '', veiculo_id: d.veiculo_id || '',
        combustivel: combBase(d.combustivel) || v?.combustivel_padrao || 'Gasolina',
        km: d.km ? String(d.km) : d.km_sugerido ? String(d.km_sugerido) : '',
        litros: numBR(d.litros, 3), valor: numBR(d.valor), posto_id: p?.id || '', posto: p?.nome || d.posto || '',
        incluir: !d.duplicado,
      })
    } catch {
      muda(l.id, { estado: 'erro', erro: 'o painel não respondeu' })
    }
  }

  const adicionar = useCallback((files: FileList | File[]) => {
    const novas: Linha[] = [...files].filter((f) => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name)).map((f) => ({
      id: ++seq.current, arquivo: f, foto: URL.createObjectURL(f), estado: 'lendo', data: '', veiculo_id: '', motorista_id: '',
      combustivel: 'Gasolina', km: '', litros: '', valor: '', posto_id: '', posto: '', incluir: true,
    }))
    setLinhas((ls) => [...ls, ...novas])
    setMsg(null)
    // 2 fotos por vez: o OCR roda no PC da empresa
    let i = 0
    const proxima = async (): Promise<void> => { const l = novas[i++]; if (!l) return; await ler(l); return proxima() }
    proxima(); proxima()
  }, [veiculos, postos]) // eslint-disable-line react-hooks/exhaustive-deps

  function soltar(e: DragEvent) { e.preventDefault(); if (e.dataTransfer.files?.length) adicionar(e.dataTransfer.files) }

  async function veiculoMudou(l: Linha, vid: string) {
    const v = veiculos.find((x) => x.id === vid)
    muda(l.id, { veiculo_id: vid, combustivel: l.combustivel || v?.combustivel_padrao || 'Gasolina' })
    if (vid && l.data && !l.lida?.km) {
      try {
        const r = await (await fetch(`${API}/km?veiculo_id=${vid}&data=${l.data}`)).json()
        if (r.km) muda(l.id, { km: String(r.km), lida: { ...(l.lida as Lida), km_como: r.como } })
      } catch { /* sem sugestão */ }
    }
  }

  const valida = (l: Linha) => l.estado === 'pronta' && l.incluir && l.data && l.veiculo_id && num(l.litros) && num(l.valor) != null
  const prontas = linhas.filter(valida)

  async function lancar() {
    if (!prontas.length) return
    setLancando(true); setMsg(null)
    const rows = prontas.map((l) => {
      const mot = motoristas.find((m) => m.id === l.motorista_id)
      const obs = [l.lida?.chave ? `NFC-e ${l.lida.chave}` : 'Importado de foto', l.lida?.fonte === 'ocr' ? '(OCR)' : ''].join(' ').trim()
      return {
        data: l.data, veiculo_id: l.veiculo_id, motorista_id: l.motorista_id || null, motorista_nome: mot?.nome ?? null,
        combustivel: l.combustivel, km: l.km ? Math.round(num(l.km)!) : null, litros: num(l.litros)!, valor: num(l.valor)!,
        posto_id: l.posto_id || null, posto: postos.find((p) => p.id === l.posto_id)?.nome ?? (l.posto || null),
        observacao: obs, origem: 'web', criado_por: session?.user.id ?? null,
      }
    })
    const { error } = await supabase.from('abastecimentos').insert(rows)
    setLancando(false)
    if (error) return setMsg('Erro ao lançar: ' + error.message)
    const ids = new Set(prontas.map((l) => l.id))
    setLinhas((ls) => ls.map((l) => (ids.has(l.id) ? { ...l, estado: 'lancada' } : l)))
    setMsg(`${rows.length} abastecimento(s) lançado(s).`)
    qc.invalidateQueries()
  }

  const lendo = linhas.filter((l) => l.estado === 'lendo').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Importar notas</h1>
          <p className="text-sm text-slate-500">Solte várias fotos de NFC-e ou comprovante. Confira a tabela e lance tudo de uma vez.</p>
        </div>
        <div className="flex gap-2">
          {linhas.some((l) => l.estado === 'lancada') && (
            <button className={btn('ghost')} onClick={() => setLinhas((ls) => ls.filter((l) => l.estado !== 'lancada'))}>Limpar lançadas</button>
          )}
          <button className={btn()} disabled={!prontas.length || lancando || lendo > 0} onClick={lancar}>
            {lancando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Lançar {prontas.length || ''} abastecimento(s)
          </button>
        </div>
      </div>

      <div onDragOver={(e) => e.preventDefault()} onDrop={soltar} onClick={() => entrada.current?.click()}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 transition hover:border-brand-500 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-900/60">
        <FileUp className="h-10 w-10" />
        <b className="text-slate-700 dark:text-slate-200">Arraste as fotos aqui ou clique para escolher</b>
        <span className="text-xs">NFC-e com QR code é lida exata pela SEFAZ. Comprovante sem QR vai por leitura de texto: confira. Nota escrita à mão: digite olhando a foto.</span>
        <input ref={entrada} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { if (e.target.files) adicionar(e.target.files); e.target.value = '' }} />
      </div>

      {msg && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">{msg}</div>}
      {lendo > 0 && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Lendo {lendo} foto(s)…</div>}

      {linhas.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60">
              <tr>
                <th className="p-2">Lançar</th><th className="p-2">Foto</th><th className="p-2">Data</th><th className="p-2">Veículo</th>
                <th className="p-2">Motorista</th><th className="p-2">Combustível</th><th className="p-2">km</th><th className="p-2">Litros</th>
                <th className="p-2">Valor</th><th className="p-2">Posto</th><th className="p-2">Leitura</th><th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const d = l.lida
                const pl = num(l.litros), vl = num(l.valor)
                const ok = valida(l)
                const fechado = l.estado === 'lancada'
                return (
                  <tr key={l.id} className={`border-t border-slate-100 align-top dark:border-slate-800 ${fechado ? 'opacity-50' : ''}`}>
                    <td className="p-2"><input type="checkbox" disabled={fechado || l.estado !== 'pronta'} checked={l.incluir && !fechado} onChange={(e) => muda(l.id, { incluir: e.target.checked })} /></td>
                    <td className="p-2">
                      <button type="button" onClick={() => setZoom(l.foto)} className="group relative block" title="Ver a foto grande">
                        <img src={l.foto} alt="" className="h-16 w-12 rounded object-cover" />
                        <ZoomIn className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 text-white drop-shadow" />
                      </button>
                    </td>
                    {l.estado === 'lendo' ? (
                      <td colSpan={9} className="p-2 text-slate-500"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />lendo {l.arquivo.name}…</td>
                    ) : l.estado === 'erro' ? (
                      <td colSpan={9} className="p-2 text-red-600">{l.arquivo.name}: {l.erro}</td>
                    ) : (
                      <>
                        <td className="p-2"><input type="date" disabled={fechado} value={l.data} onChange={(e) => muda(l.id, { data: e.target.value })} className={base} />{d?.hora && <span className="text-[10px] text-slate-400">{d.hora}</span>}</td>
                        <td className="p-2 min-w-[130px]">
                          <select disabled={fechado} value={l.veiculo_id} onChange={(e) => veiculoMudou(l, e.target.value)} className={`${base} ${!l.veiculo_id ? 'border-amber-400' : ''}`}>
                            <option value="">— escolha —</option>
                            {veiculos.map((v) => <option key={v.id} value={v.id}>{v.nome} · {v.placa}</option>)}
                          </select>
                          {d?.placa && <span className="text-[10px] text-slate-400">placa na nota: {d.placa}</span>}
                        </td>
                        <td className="p-2 min-w-[120px]">
                          <select disabled={fechado} value={l.motorista_id} onChange={(e) => muda(l.id, { motorista_id: e.target.value })} className={base}>
                            <option value="">—</option>
                            {motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                          </select>
                        </td>
                        <td className="p-2">
                          <select disabled={fechado} value={l.combustivel} onChange={(e) => muda(l.id, { combustivel: e.target.value })} className={base}>
                            {COMBUSTIVEIS.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="p-2 min-w-[80px]">
                          <input disabled={fechado} inputMode="numeric" value={l.km} onChange={(e) => muda(l.id, { km: e.target.value })} className={base} />
                          {!d?.km && d?.km_como && l.km && <span className="text-[10px] text-slate-400" title={d.km_como}>sugerido pelo GPS</span>}
                        </td>
                        <td className="p-2 min-w-[70px]"><input disabled={fechado} inputMode="decimal" value={l.litros} onChange={(e) => muda(l.id, { litros: e.target.value })} className={`${base} ${!pl ? 'border-amber-400' : ''}`} /></td>
                        <td className="p-2 min-w-[80px]">
                          <input disabled={fechado} inputMode="decimal" value={l.valor} onChange={(e) => muda(l.id, { valor: e.target.value })} className={`${base} ${vl == null ? 'border-amber-400' : ''}`} />
                          {pl && vl ? <span className="text-[10px] text-slate-400">{fmtBRL(vl / pl)}/L</span> : null}
                        </td>
                        <td className="p-2 min-w-[140px]">
                          <select disabled={fechado} value={l.posto_id} onChange={(e) => muda(l.id, { posto_id: e.target.value })} className={base}>
                            <option value="">{l.posto ? `(${l.posto.slice(0, 28)})` : '—'}</option>
                            {postos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                          </select>
                        </td>
                        <td className="p-2 max-w-[220px] text-[11px]">
                          {fechado ? <span className="text-emerald-600">✔ lançada</span> : (
                            <>
                              <span className={`rounded-full px-1.5 py-0.5 font-semibold ${d?.fonte === 'nfce' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'}`}>
                                {d?.fonte === 'nfce' ? 'NFC-e (SEFAZ)' : 'OCR: confira'}
                              </span>
                              {d?.duplicado && <div className="mt-1 text-red-600"><AlertTriangle className="mr-0.5 inline h-3 w-3" />{d.duplicado}</div>}
                              {d?.avisos?.map((a, i) => <div key={i} className="mt-1 text-slate-500">{a}</div>)}
                              {!ok && l.incluir && <div className="mt-1 text-amber-600">falta {[!l.data && 'data', !l.veiculo_id && 'veículo', !pl && 'litros', vl == null && 'valor'].filter(Boolean).join(', ')}</div>}
                            </>
                          )}
                        </td>
                      </>
                    )}
                    <td className="p-2">{!fechado && <button title="Tirar da lista" onClick={() => setLinhas((ls) => ls.filter((x) => x.id !== l.id))}><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500" /></button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  )
}
