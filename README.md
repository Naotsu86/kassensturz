# Reise-Kasse (Vite + Vue + PWA)

## Lokale Entwicklung
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## GitHub Pages Deployment (kurz)
- `npm run build` erzeugt `dist/`
- Inhalte aus `dist/` auf GitHub Pages veröffentlichen (z.B. über GitHub Actions)

Die App ist als PWA konfiguriert (vite-plugin-pwa): nach dem ersten Laden kann sie offline laufen und auf dem Homescreen installiert werden.
