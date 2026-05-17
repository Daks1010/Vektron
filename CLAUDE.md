# Vektron - Claude Code Instructions

## Project
AI team workspace. React 19 + Tailwind v4 + Zustand frontend, Express + TypeScript backend, Supabase auth, SSE streaming.

## Stack
- Frontend: React, Tailwind v4, Zustand, Vite
- Backend: Express + TypeScript (server.ts + src/server/api.ts)
- Auth: Supabase
- Providers: OpenAI, Anthropic, Gemini, xAI, Ollama

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`

## RULES — ALWAYS FOLLOW
- Always write changes directly to the actual files. Never show code in terminal without applying it.
- After every change, state which files were modified and what changed.
- Use Zustand's `create` pattern (not svelte writable). See src/store/useStore.ts.
- Keep dark theme: background #0d0d0f, surface #141416, border #2a2a2e, accent #7c6ff7.
- All components use TypeScript + Tailwind only. No inline styles.
- Never use random/placeholder logic in production code.