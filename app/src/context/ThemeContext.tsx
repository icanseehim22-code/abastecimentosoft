import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

type ThemeContextType = {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // dentro do painel (iframe): segue o tema do painel
    try {
      if (window.self !== window.top) {
        const pai = window.parent.document.documentElement.getAttribute('data-theme')
        return pai === 'light' ? 'light' : 'dark'
      }
    } catch { /* outro domínio */ }
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const root = window.document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  // painel trocou claro/escuro: o app troca junto
  useEffect(() => {
    try {
      if (window.self === window.top) return
      const raiz = window.parent.document.documentElement
      const obs = new MutationObserver(() => setTheme(raiz.getAttribute('data-theme') === 'light' ? 'light' : 'dark'))
      obs.observe(raiz, { attributes: true, attributeFilter: ['data-theme'] })
      return () => obs.disconnect()
    } catch { /* outro domínio */ }
  }, [])

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
