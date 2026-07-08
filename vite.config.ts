import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Prints a loud reminder on dev start and build when the bundled datasets
 * are from a past year. Deliberately a warning, not an error — a stale
 * vintage must never block an unrelated fix or deploy. Bump DATA_VINTAGE
 * in src/data/vintage.ts after refreshing the static cards.
 */
function warnIfStaleVintage(): void {
  // Read the constant from the source file instead of importing it: the
  // node tsconfig uses nodenext resolution, which rejects extensionless
  // relative TS imports from vite.config.ts.
  const src = readFileSync(new URL('./src/data/vintage.ts', import.meta.url), 'utf8')
  const vintage = Number(/DATA_VINTAGE = (\d{4})/.exec(src)?.[1])
  const thisYear = new Date().getFullYear()
  if (!vintage || thisYear <= vintage) return
  console.warn(
    '\n' +
      '┌──────────────────────────────────────────────────────────────┐\n' +
      `│  ⚠ STALE BUNDLED DATA — vintage ${vintage}, ${thisYear - vintage} year(s) behind.\n` +
      '│  Refresh the static cards (see src/data/vintage.ts for the\n' +
      '│  checklist), then bump DATA_VINTAGE to the current year.\n' +
      '└──────────────────────────────────────────────────────────────┘\n',
  )
}

function dataVintageCheck(): Plugin {
  return {
    name: 'data-vintage-check',
    buildStart: warnIfStaleVintage,
    configureServer: () => warnIfStaleVintage(),
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works under a GitHub Pages project path.
  base: './',
  plugins: [react(), dataVintageCheck()],
})
