# ExamAI Híbrido

Sistema integrado de Generador Avanzado de Exámenes Académicos y módulo Antiplagio + Detección de IA, con backend Python FastAPI y frontend React PWA.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/examai/src/` — React frontend (Vite + Tailwind + Lucide)
- `artifacts/examai/src/pages/` — Dashboard, ExamGenerator, PlagiarismDetector
- `artifacts/examai/src/components/` — Header, SettingsModal, ExamHistory, StatsPanel, Dropzone, LoadingScreen, ExamResult
- `artifacts/examai/src/lib/utils.ts` — localStorage utilities, types, chunk helper
- `artifacts/examai/src/lib/wordExport.ts` — Word (.docx) export
- `artifacts/api-server/main.py` — Python FastAPI backend (upload, generate-exam, detect)
- `artifacts/examai/public/manifest.json` — PWA manifest

## Architecture decisions

- **Backend Python FastAPI** en lugar del Express Node.js por su librería de extracción de archivos (pdfplumber, python-docx, python-pptx).
- **API Key Pool**: múltiples llaves por coma con rotación automática ante errores 429.
- **localStorage persistente**: historial de exámenes (50 entradas), settings y estadísticas de uso sin DB.
- **Chunking con overlap**: bloques de 800 palabras con 150 palabras de solapamiento para preservar contexto.
- **Generación en lotes de 10**: para evitar timeouts en exámenes de 40 preguntas.

## Product

- **Generador de Exámenes**: sube PDF/DOCX/PPTX/TXT → configura IA (Gemini/Groq/Cohere), dificultad y cantidad → genera hasta 40 preguntas con respuestas → descarga en Word.
- **Detector Antiplagio + IA**: analiza texto (archivo o pegado) con métricas de perplejidad, burstiness y probabilidad de IA.
- **Dashboard**: historial de exámenes con búsqueda, estadísticas de uso y accesos directos.
- **PWA instalable** en móviles y desktop.

## User preferences

- Interfaz en español, dark mode estilo Apple/Cupertino.
- No usar emojis en UI de la aplicación (solo iconos SVG Lucide).

## Gotchas

- Para ejecutar el backend: `uvicorn main:app --host 0.0.0.0 --port 8080 --reload` desde `artifacts/api-server/`
- Las llaves de API se guardan en `localStorage` del navegador (nunca en el servidor).
- El backend usa `await file.seek(0)` para evitar el bug de archivos 0.0KB.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
