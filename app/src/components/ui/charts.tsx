import { useMemo } from 'react'
import { useTheme } from '../../context/ThemeContext'

/** Paleta unificada de gráficos (brand-forward). */
export const CHART_COLORS = [
  '#3b62f0', '#16a34a', '#f59e0b', '#8b5cf6', '#06b6d4',
  '#ef4444', '#ec4899', '#14b8a6', '#6366f1', '#84cc16',
]

/** Tema de gráfico reativo ao dark mode. */
export function useChartTheme() {
  const { theme } = useTheme()
  return useMemo(() => {
    const isDark = theme === 'dark'
    return {
      isDark,
      grid: isDark ? '#1e293b' : '#eef2f7',
      axis: isDark ? '#94a3b8' : '#64748b',
      colors: CHART_COLORS,
      cursor: { fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.06)' },
      cursorLine: { stroke: isDark ? '#334155' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' },
    }
  }, [theme])
}

type TooltipRow = { name?: string; value?: number | string; color?: string; dataKey?: string }

/**
 * Tooltip custom, bonito e dark-aware.
 * Passe `formatter(value, name)` para formatar cada linha e
 * `labelFormatter(label)` para o título.
 */
export function ChartTooltip({
  active, payload, label, formatter, labelFormatter, hideLabel,
}: {
  active?: boolean
  payload?: TooltipRow[]
  label?: string | number
  formatter?: (value: number, name?: string) => React.ReactNode
  labelFormatter?: (label: string | number) => React.ReactNode
  hideLabel?: boolean
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  if (!active || !payload || payload.length === 0) return null

  return (
    <div
      style={{
        background: isDark ? 'rgba(15,23,42,0.96)' : 'rgba(255,255,255,0.98)',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(2,6,23,0.18)',
        padding: '9px 12px',
        backdropFilter: 'blur(6px)',
      }}
    >
      {!hideLabel && label != null && (
        <div style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {payload.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color ?? '#3b62f0', flexShrink: 0 }} />
            <span style={{ color: isDark ? '#f1f5f9' : '#1e293b', fontSize: 12.5, fontWeight: 700 }}>
              {formatter ? formatter(Number(p.value), p.name) : String(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Formata o eixo de valores em "R$Xk" (milhares). */
export function tickBRLk(v: number): string {
  if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
  return `R$${v}`
}
