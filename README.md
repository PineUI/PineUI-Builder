# 🍍 PineUI Builder

> AI-powered UI builder — describe interfaces in plain language and get production-quality PineUI JSON schemas instantly, rendered live, powered by Claude.

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-Sonnet%204.6-D97706?style=flat-square&logo=anthropic&logoColor=white)
![PineUI](https://img.shields.io/badge/PineUI-React-6750A4?style=flat-square)
![License](https://img.shields.io/badge/license-Apache%202.0%20%2B%20Commons%20Clause-blue?style=flat-square)

---

## About PineUI

> ⚠️ **Alpha Software — Not production-ready**
>
> PineUI is under active development. APIs, schema contracts, and component behavior will change without notice. Use for experimentation and feedback only.

**[PineUI](https://github.com/PineUI/PineUI)** is a complete protocol and multi-platform SDK for building declarative interfaces rendered from JSON, with centralized governance on the server. Designed to scale to millions of users and be comprehensible by Large Language Models.

🍍 **Why "PineUI"?** In Brazilian Portuguese, we have an expression: *"descascar esse abacaxi"* (literally "peeling this pineapple"), which means solving a tough problem. PineUI helps you peel through the tough challenges of building dynamic, multi-platform UIs.

🚀 **[Try it now](https://pineui.github.io/PineUI/)** · 📖 **[Complete Documentation](https://pineui.github.io/PineUI/documentation.html)**

👨‍💻 **Created by [David Ruiz](https://github.com/wupsbr)** — CPTO at Ingresse, former Director of Engineering at iFood (R$70B+ GMV), CTO at Paraná Banco, and co-founder of ONOVOLAB.

🏢 **Developed by [Luma Ventures](https://lumaventures.com.br)** | CNPJ: 21.951.820/0001-39

---

## What is PineUI Builder?

PineUI Builder is a web app that converts natural language into working [PineUI](https://github.com/PineUI/PineUI) JSON schemas — visually rendered and ready to copy. It's designed to feel like a senior designer and engineer working together: it follows Material Design 3 conventions, uses realistic data, and builds interfaces at the quality level of Linear, Vercel, or Stripe.

Type *"a task manager with categories and status badges"* and get a complete, production-quality schema in seconds.

---

## Features

- **Conversational chat** — follow-up messages make targeted edits to the existing schema, not regenerate everything
- **Live streaming** — tokens appear as Claude writes them; JSON previews in Code tab during generation
- **Side-by-side preview** — View (rendered PineUI) and Code (JSON) toggle with one click
- **Project persistence** — every generated schema is auto-saved with a stable URL (`/projects/:id`)
- **Project gallery** — browse, load, and delete past projects from the top bar
- **SPA routing** — reload `/projects/:id` and the project is restored with full conversation context
- **AI design guide** — `data/DESIGN.md` injects senior UI/UX designer principles (M3 color system, type scale, spacing grid, SaaS patterns) into every generation
- **Always latest PineUI** — version resolved from npm registry at startup; bundle downloaded and served from the same origin to avoid CDN/CORS issues
- **iframe console forwarding** — PineUI render errors appear in the parent DevTools console with `[PineUI]` prefix
- **Rate limiting** — 10 requests/minute per IP

---

## Preview

```
┌─────────────────────────┬──────────────────────────────────────┐
│  🍍 PineUI Builder      │ [Projects]          [View] [Code] [⎘] │
├─────────────────────────┼──────────────────────────────────────┤
│                         │                                      │
│  ┌───────────────────┐  │   Rendered PineUI interface          │
│  │ AI response       │  │   or live-streaming JSON             │
│  └───────────────────┘  │                                      │
│                         │                                      │
│  [ Type a prompt...  ➤] │                                      │
└─────────────────────────┴──────────────────────────────────────┘
```

---

## Stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express (ESM) |
| AI | Anthropic Claude `claude-sonnet-4-6` via SSE streaming |
| Frontend | Vanilla JS + Material Design 3 (dark theme) |
| UI Rendering | PineUI React — bundle served locally from `/pineui/` |
| Persistence | JSON files in `data/` + `public/schemas/` |
| Rate Limiting | `express-rate-limit` |

---

## Getting Started

### 1. Clone

```bash
git clone git@github.com:PineUI/PineUI-Builder.git
cd PineUI-Builder
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
```

> Get your API key at [console.anthropic.com](https://console.anthropic.com)

### 4. Run

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Open [http://localhost:3000](http://localhost:3000)

On first start the server will:
1. Fetch the latest `PROMPT.md` from the PineUI GitHub repo
2. Resolve the latest `@pineui/react` version from npm
3. Download and cache the PineUI JS + CSS bundle locally

---

## Deploying

### Heroku

```bash
heroku create your-app-name
heroku config:set ANTHROPIC_API_KEY=sk-ant-...
git push heroku main
```

> The `Procfile` and `engines` field in `package.json` are already configured.
> **Never commit your `.env` file** — set secrets via `heroku config:set`.

---

## How it works

1. User types a prompt in the chat
2. Server fetches `PROMPT.md` from GitHub (cached 5 min, saved locally as fallback) and the `DESIGN.md` guide from disk
3. System prompt = `PROMPT.md` (PineUI component docs) + `DESIGN.md` (design excellence guide) + response rules
4. Claude streams a PineUI JSON schema via SSE — the Code tab shows JSON live as it arrives
5. On completion, the schema is parsed, rendered in the iframe (using the locally-served PineUI bundle), and auto-saved
6. The project URL updates to `/projects/:id` — shareable and reloadable
7. Follow-up messages carry the current schema as conversation context so Claude makes incremental edits

---

## AI System Context

The AI receives three layers of context on every request:

| File | Source | Purpose |
|---|---|---|
| `data/PROMPT.md` | GitHub (cached 5 min) | PineUI component API — all types, props, actions, bindings |
| `data/DESIGN.md` | Local | Senior UI/UX designer guide — M3 color roles, type scale, spacing grid, SaaS patterns, anti-patterns |
| Response rules | Hardcoded | Output format, incremental edit behaviour |

To update `DESIGN.md`, edit `data/DESIGN.md` directly and restart the server.

---

## API

### `POST /api/generate`

Generate or edit a PineUI schema.

**Rate limit:** 10 requests/minute per IP.

**Body:**
```json
{
  "prompt": "A login form with email and password",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response:** `text/event-stream`

```
data: {"text": "Here is a login form..."}
data: {"text": "```json\n{\n  \"schemaVersion\"..."}
data: [DONE]
```

---

### `GET /api/pineui-version`

Returns the resolved PineUI version and local bundle paths.

```json
{
  "version": "0.1.7",
  "js":  "/pineui/pineui-0.1.7.js",
  "css": "/pineui/pineui-0.1.7.css"
}
```

---

### `POST /api/projects`

Save or update a project.

**Body:** `{ schema, name, prompt, id? }`

**Response:** `{ id, name, prompt, createdAt, updatedAt, url }`

---

### `GET /api/projects`

List all saved projects (manifest).

---

### `GET /api/projects/load/:id`

Load a project schema by ID.

---

### `DELETE /api/projects/:id`

Delete a project and its schema file.

---

## Project Structure

```
PineUI-Builder/
├── server.js              # Express server, Claude API, project CRUD
├── public/
│   ├── index.html         # Frontend — chat, preview, project gallery
│   ├── schemas/           # Saved project JSON schemas (gitignored)
│   └── pineui/            # Locally cached PineUI bundle (gitignored)
│       ├── pineui-{v}.js
│       └── pineui-{v}.css
├── data/
│   ├── PROMPT.md          # PineUI component docs (fetched from GitHub)
│   ├── DESIGN.md          # UI/UX excellence guide (committed)
│   └── projects.json      # Project manifest (gitignored)
├── .env.example
├── .gitignore
├── Procfile
└── package.json
```

---

## Security

- `.env` is gitignored — API keys never leave your machine
- Rate limiting prevents abuse of the Claude API
- Schema files are served from a safe, sandboxed path (`/schemas/:id`)
- No user authentication — intended for internal/personal use

---

## Related

- [PineUI](https://github.com/PineUI/PineUI) — The Server-Driven UI framework
- [Anthropic Claude API](https://docs.anthropic.com)
- [Material Design 3](https://m3.material.io)

---

## Contact

**Commercial Licensing:**
- 📧 Email: [wupsbr@gmail.com](mailto:wupsbr@gmail.com)
- 🏢 Company: Luma Ventures Ltda
- 📋 CNPJ: 21.951.820/0001-39

**Community:**
- 🐙 GitHub: [github.com/pineui/pineui](https://github.com/pineui/pineui)
- 🐛 Issues: [github.com/pineui/pineui/issues](https://github.com/pineui/pineui/issues)
- 💬 Discussions: [github.com/pineui/pineui/discussions](https://github.com/pineui/pineui/discussions)

---

**Created by [David Ruiz](https://github.com/wupsbr)** — CPTO at Ingresse
