# 🌲 PineUI Builder

> AI-powered UI builder — describe interfaces in natural language and get PineUI JSON schemas instantly, rendered in real-time, powered by Claude.

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-Sonnet%204.6-D97706?style=flat-square&logo=anthropic&logoColor=white)
![PineUI](https://img.shields.io/badge/PineUI-React-6750A4?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

---

## What is this?

PineUI Builder is a web app that lets you describe a UI in plain language and instantly get a working [PineUI](https://github.com/PineUI/PineUI) JSON schema — both rendered visually and as copyable code.

Type something like *"a task manager with categories and status badges"* and Claude generates the complete schema, live.

---

## Features

- **Chat interface** — conversational, with context memory across messages
- **Live streaming** — responses appear token by token, like ChatGPT
- **Side-by-side preview** — View (rendered PineUI) and Code (JSON) toggle
- **Copy button** — grab the schema with one click
- **Rate limiting** — 10 requests/minute per IP to prevent abuse
- **Heroku-ready** — `Procfile` + `engines` configured out of the box

---

## Preview

```
┌─────────────────────┬──────────────────────────────┐
│  🌲 PineUI Builder  │          Preview              │
├─────────────────────┤  [ View ]  [ Code ]  [ Copy ] │
│  Chat messages...   ├──────────────────────────────┤
│                     │                              │
│                     │   Rendered PineUI schema     │
│  [  Type a prompt ] │   or JSON code view          │
└─────────────────────┴──────────────────────────────┘
```

---

## Stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express |
| AI | Anthropic Claude (`claude-sonnet-4-6`) via SSE streaming |
| Frontend | Vanilla JS + Material Design 3 (dark theme) |
| UI Rendering | [PineUI React](https://github.com/PineUI/PineUI) via CDN |
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
# Production
npm start

# Development (auto-reload)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploying to Heroku

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
2. The server fetches the [PineUI PROMPT.md](https://github.com/PineUI/PineUI/blob/main/PROMPT.md) (cached after first request) and sends it as system context to Claude
3. Claude streams a valid PineUI JSON schema back via SSE
4. The frontend renders the schema using the PineUI CDN in the View tab
5. The raw JSON is available in the Code tab

---

## API

### `POST /api/generate`

Generate a PineUI schema from a natural language prompt.

**Rate limit:** 10 requests per minute per IP.

**Request body:**
```json
{
  "prompt": "A login form with email and password fields",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response:** `text/event-stream` (SSE)

```
data: {"text": "Here is a login form..."}
data: {"text": "```json\n{..."}
data: [DONE]
```

---

## Project Structure

```
PineUI-Builder/
├── server.js          # Express server + Claude API integration
├── public/
│   └── index.html     # Frontend (chat + preview)
├── .env.example       # Environment variable template
├── .gitignore         # Keeps .env and node_modules out of git
├── Procfile           # Heroku process definition
└── package.json       # Dependencies and scripts
```

---

## Security

- `.env` is gitignored — API keys never leave your machine
- Rate limiting prevents abuse of the Claude API
- No user data is stored server-side

---

## Related

- [PineUI](https://github.com/PineUI/PineUI) — The Server-Driven UI framework
- [PineUI Documentation](https://pineui.github.io/PineUI/documentation.html)
- [Anthropic Claude API](https://docs.anthropic.com)
- [Material Icons](https://fonts.google.com/icons)

---

**Created by [David Ruiz](https://github.com/wupsbr)** — CPTO at Ingresse
