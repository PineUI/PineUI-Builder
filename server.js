import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import https from 'https';
import rateLimit from 'express-rate-limit';
import { createHash, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = join(__dirname, 'public', 'schemas');
const DATA_DIR    = join(__dirname, 'data');
const MANIFEST    = join(DATA_DIR, 'projects.json');

function ensureDirs() {
  if (!existsSync(SCHEMAS_DIR)) mkdirSync(SCHEMAS_DIR, { recursive: true });
  if (!existsSync(DATA_DIR))    mkdirSync(DATA_DIR,    { recursive: true });
  if (!existsSync(MANIFEST))    writeFileSync(MANIFEST, '[]', 'utf8');
}
ensureDirs();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Logger ────────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
};

function ts() {
  return `${c.dim}[${new Date().toISOString()}]${c.reset}`;
}

const log = {
  info: (msg) => console.log(`${ts()} ${c.cyan}INFO${c.reset}  ${msg}`),
  ok:   (msg) => console.log(`${ts()} ${c.green}OK${c.reset}    ${msg}`),
  warn: (msg) => console.log(`${ts()} ${c.yellow}WARN${c.reset}  ${msg}`),
  err:  (msg) => console.log(`${ts()} ${c.red}ERROR${c.reset} ${msg}`),
  req:  (msg) => console.log(`${ts()} ${c.magenta}REQ${c.reset}   ${msg}`),
};

// ── Request logger middleware ─────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 500 ? c.red : status >= 400 ? c.yellow : c.green;
    log.req(`${c.bold}${req.method}${c.reset} ${req.path} → ${color}${status}${c.reset} ${c.dim}(${ms}ms)${c.reset}`);
  });
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

// ── Rate limit ────────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    log.warn(`Rate limit hit — IP: ${c.yellow}${ip}${c.reset}`);
    res.status(429).json({ error: 'Too many requests. Please wait a moment before trying again.' });
  },
});

// ── PineUI version ────────────────────────────────────────────────────────────
let pineUIVersion = 'latest';

async function fetchLatestVersion() {
  return new Promise((resolve, reject) => {
    https.get(
      'https://registry.npmjs.org/@pineui/react/latest',
      { headers: { 'Accept': 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data).version); }
          catch { resolve('latest'); }
        });
      }
    ).on('error', () => resolve('latest'));
  });
}

app.get('/api/pineui-version', (req, res) => {
  res.json({ version: pineUIVersion });
});

// ── PineUI context ────────────────────────────────────────────────────────────
let pineUIPrompt = null;

async function fetchPineUIPrompt() {
  return new Promise((resolve, reject) => {
    https.get(
      'https://raw.githubusercontent.com/PineUI/PineUI/main/PROMPT.md',
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      }
    ).on('error', reject);
  });
}

async function getPineUIPrompt() {
  if (!pineUIPrompt) {
    log.info('Fetching PineUI PROMPT.md from GitHub...');
    pineUIPrompt = await fetchPineUIPrompt();
    log.ok(`PineUI context loaded — ${c.dim}${pineUIPrompt.length} chars${c.reset}`);
  } else {
    log.info(`Using cached PineUI context ${c.dim}(${pineUIPrompt.length} chars)${c.reset}`);
  }
  return pineUIPrompt;
}

// ── Generate endpoint ─────────────────────────────────────────────────────────
app.post('/api/generate', limiter, async (req, res) => {
  const { prompt, history = [] } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  if (!prompt?.trim()) {
    log.warn(`Empty prompt received from ${ip}`);
    return res.status(400).json({ error: 'Prompt is required' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    log.err('ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const promptPreview = prompt.length > 80 ? prompt.slice(0, 80) + '…' : prompt;
  log.info(`New request from ${c.cyan}${ip}${c.reset} — history: ${history.length / 2} turns`);
  log.info(`Prompt: "${c.bold}${promptPreview}${c.reset}"`);

  try {
    const pineContext = await getPineUIPrompt();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `You are an expert PineUI schema generator. Use the following PineUI documentation to generate valid JSON schemas.

${pineContext}

---

## STRICT COMPONENT CONTRACT — based on current PineUI SDK

### Layout
- layout.column — props: children, padding, spacing, mainAxisAlignment, crossAxisAlignment, width, height
- layout.row — same props as layout.column
- layout.grid — props: children, columns, spacing, responsive
- layout.scaffold — props: body, appBar ({title, leading, actions}), bottomNav, floatingActionButton

### Display
- text — props: content, style, color, align
  - style values: displayLarge, displayMedium, displaySmall, headlineLarge, headlineMedium, headlineSmall, titleLarge, titleMedium, titleSmall, bodyLarge, bodyMedium, bodySmall, labelLarge, labelMedium, labelSmall
- image — props: src (NOT url), alt, width, height, fit ("cover"|"contain"|"fill"), borderRadius
- avatar — props: src (NOT url), alt, size, fallback
- icon — props: name (Material Icons name), size, color
- card — props: children (plural, NOT child), variant ("elevated"|"filled"|"outlined"), padding, onPress
- badge — props: label, color ("primary"|"secondary"|"error"|"success"|"warning"|"info")
- chip — props: label, variant ("outlined"|"filled"), selected, icon, onPress
- divider — props: spacing
- progress.circular — props: size, color
- progress.linear — props: value (0–100), color

### Buttons
- button.filled — props: label, icon, iconPosition, onPress, disabled, fullWidth
- button.outlined — props: label, icon, iconPosition, onPress, disabled, fullWidth
- button.text — props: label, icon, iconPosition, onPress, disabled, fullWidth
- button.elevated — props: label, icon, iconPosition, onPress, disabled, fullWidth
- button.tonal — props: label, icon, iconPosition, onPress, disabled, fullWidth

### Inputs
- input.text — props: label, placeholder, value, required, disabled, error, helperText, onChange
- input.email — props: same as input.text
- input.password — props: same as input.text
- input.number — props: same as input.text
- input.textarea — props: same as input.text (multi-line)

### Collections & Conditional
- collection.map — props: data ("{{state.array}}"), template (component node using {{item}} and {{index}})
- conditional.render — props: condition ("{{expr}}" string), children (shown when true), fallback (shown when false, optional)

### Modals
- modal — inline in screen tree, props: id, title, fullScreen (boolean), children
- action.overlay.show — props: overlayId
- action.overlay.hide — props: overlayId

### Actions
- action.http.request — props: url, method, body, onSuccess (use {{response}} for response data), onError
- action.state.patch — props: path, value
- action.overlay.show — props: overlayId
- action.overlay.hide — props: overlayId
- action.snackbar.show — props: message, duration, action ({label, onPress})
- action.delay — props: duration, then (action)
- action.sequence — props: actions (array of action objects)

### Intents
- Define in "intents" key: {"intentName": {"handler": ActionNode}}
- Call with: {"type": "intent", "name": "intentName"}

NEVER invent component or action types. NEVER use "url" on image/avatar — use "src". NEVER use "action.overlay.open/close" — use "action.overlay.show/hide". NEVER use "conditionalRender" — use "conditional.render". NEVER use bare "collection" — use "collection.map". NEVER use "onChanged" on inputs — use "onChange". NEVER use "child" singular on card — use "children". In onSuccess of action.http.request, access response data with {{response}}.

---

DESIGN QUALITY STANDARDS — Follow these always:

You are building interfaces at the quality level of Google, Airbnb, Stripe, and Linear. Every schema must feel polished and production-ready.

**Layout & Spacing**
- Use generous padding: 16–24px inside cards, 24–32px for page padding
- Use consistent spacing rhythm: prefer 8, 12, 16, 24, 32px gaps
- Never stack elements without breathing room — spacing between sections: 24–40px
- Group related items visually; separate unrelated sections with dividers or whitespace

**Typography Hierarchy**
- Every screen needs a clear visual hierarchy: one dominant headline, supporting body text, labels
- Use titleLarge or headlineMedium for page/section titles
- Use bodyMedium or bodySmall for supporting text, always in a muted color (#79747E or onSurfaceVariant)
- Never use the same text style for everything — vary styles to guide the eye

**Color & Visual Polish**
- Use the primary color (#6750A4) for key actions and highlights only — don't overuse it
- Use subtle background colors on cards and sections to create depth (e.g. variant: "elevated" or "filled")
- Badges, chips, and status indicators should use semantic colors: success=green, error=red, warning=amber
- Prefer hex colors that match MD3 palette for consistency

**Components & Patterns**
- Always use layout.scaffold with appBar for screens that represent full pages
- Cards should contain complete, scannable content — image + title + metadata + action
- Use collection.map for lists/grids — never hardcode more than 2-3 example items inline
- Use chips for filters/categories, badges for status, avatars for people
- Every interactive element needs visual affordance (buttons, chips, cards with onPress)
- Use progress indicators for data that loads asynchronously
- Empty states and loading states make UIs feel complete — include them with conditional.render

**Real-World Data**
- Use realistic names, prices, dates, descriptions — not "Item 1", "Test", "Lorem ipsum"
- Images: use https://picsum.photos/seed/KEYWORD/WIDTH/HEIGHT for consistent, relevant photos
- Avatars: use https://i.pravatar.cc/150?img=NUMBER (1–70) for realistic user photos

RESPONSE RULES:
- Always respond with a valid PineUI JSON schema wrapped in a \`\`\`json code block
- Before the JSON, write a brief 1-2 sentence description of what you built or changed
- Never include any explanation after the JSON block
- When the conversation history already contains a schema, make TARGETED changes to it — only modify what the user asks for. Preserve existing components, data, and structure unless explicitly told to change them.`;

    const messages = [
      ...history.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: prompt },
    ];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    log.info(`Streaming started — model: ${c.magenta}claude-sonnet-4-6${c.reset}`);
    const streamStart = Date.now();
    let charCount = 0;

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        charCount += chunk.delta.text.length;
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    const elapsed = ((Date.now() - streamStart) / 1000).toFixed(1);
    log.ok(`Stream complete — ${c.green}${charCount} chars${c.reset} in ${c.green}${elapsed}s${c.reset}`);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    log.err(`Claude API error: ${c.red}${err.message}${c.reset}`);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── Projects ──────────────────────────────────────────────────────────────────
function readManifest() {
  try { return JSON.parse(readFileSync(MANIFEST, 'utf8')); }
  catch { return []; }
}
function writeManifest(data) {
  writeFileSync(MANIFEST, JSON.stringify(data, null, 2), 'utf8');
}

app.post('/api/projects', (req, res) => {
  const { schema, name, prompt, id: requestedId } = req.body;
  if (!schema || typeof schema !== 'object') {
    return res.status(400).json({ error: 'Invalid schema' });
  }

  // Use caller-supplied session ID if valid, otherwise content hash
  const id = (requestedId && /^[a-f0-9]{10}$/.test(requestedId))
    ? requestedId
    : createHash('sha256').update(JSON.stringify(schema)).digest('hex').slice(0, 10);

  const filePath = join(SCHEMAS_DIR, `${id}.json`);
  writeFileSync(filePath, JSON.stringify(schema, null, 2), 'utf8');

  const projects = readManifest();
  const existing = projects.findIndex(p => p.id === id);
  const entry = {
    id,
    name: (name || prompt || 'Untitled').slice(0, 80),
    prompt: (prompt || '').slice(0, 200),
    createdAt: existing >= 0 ? projects[existing].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    url: `/schemas/${id}.json`,
  };

  if (existing >= 0) projects[existing] = entry;
  else projects.unshift(entry);

  writeManifest(projects);
  log.ok(`Project saved — id: ${c.cyan}${id}${c.reset} name: "${entry.name}"`);
  res.json(entry);
});

app.get('/api/projects', (req, res) => {
  res.json(readManifest());
});

app.delete('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  if (!/^[a-f0-9]{10}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid project id' });
  }
  const projects = readManifest();
  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const filePath = join(SCHEMAS_DIR, `${id}.json`);
  if (existsSync(filePath)) unlinkSync(filePath);
  projects.splice(idx, 1);
  writeManifest(projects);
  log.ok(`Project deleted — id: ${c.cyan}${id}${c.reset}`);
  res.json({ ok: true });
});

// Safe local schema loader — only serves from public/schemas/
app.get('/api/projects/load/:filename', (req, res) => {
  const filename = req.params.filename.replace(/[^a-f0-9]/g, '');
  if (!filename) return res.status(400).json({ error: 'Invalid filename' });

  const filePath = join(SCHEMAS_DIR, `${filename}.json`);
  if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  try {
    const schema = JSON.parse(readFileSync(filePath, 'utf8'));
    res.json(schema);
  } catch {
    res.status(500).json({ error: 'Failed to parse schema file' });
  }
});

// SPA route — /projects/:id serves index.html (frontend handles the load)
app.get('/projects/:id', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ── API error handler (must be after all routes) ──────────────────────────────
app.use('/api', (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.type === 'entity.too.large'
    ? 'Schema too large (max 2mb)'
    : err.message || 'Internal server error';
  log.err(`API error on ${req.method} ${req.path}: ${message}`);
  res.status(status).json({ error: message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log(`  ${c.bold}${c.green}🍍 PineUI Builder${c.reset}`);
  console.log(`  ${c.dim}Running at${c.reset} ${c.cyan}http://localhost:${PORT}${c.reset}`);
  console.log(`  ${c.dim}Rate limit: 10 req/min per IP${c.reset}`);
  console.log('');
  getPineUIPrompt().catch((err) => log.err(`Failed to preload context: ${err.message}`));
  fetchLatestVersion().then((v) => {
    pineUIVersion = v;
    log.ok(`PineUI version resolved — ${c.cyan}${v}${c.reset}`);
  }).catch(() => log.warn('Could not resolve PineUI version, using @latest'));
});
