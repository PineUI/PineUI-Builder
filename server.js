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
const SCHEMAS_DIR  = join(__dirname, 'public', 'schemas');
const PINEUI_DIR   = join(__dirname, 'public', 'pineui');
const DATA_DIR     = join(__dirname, 'data');
const MANIFEST     = join(DATA_DIR, 'projects.json');
const PROMPT_FILE  = join(DATA_DIR, 'PROMPT.md');
const DESIGN_FILE  = join(DATA_DIR, 'DESIGN.md');

function ensureDirs() {
  if (!existsSync(SCHEMAS_DIR)) mkdirSync(SCHEMAS_DIR, { recursive: true });
  if (!existsSync(PINEUI_DIR))  mkdirSync(PINEUI_DIR,  { recursive: true });
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

// ── PineUI context ────────────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let pineUIPrompt     = null;
let pineUIPromptAt   = 0;
let pineUIVersion    = null;
let pineUIVersionAt  = 0;

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function getPineUIVersion() {
  const now = Date.now();
  if (pineUIVersion && (now - pineUIVersionAt) < CACHE_TTL) return pineUIVersion;

  try {
    const raw = await fetchUrl('https://registry.npmjs.org/@pineui/react/latest');
    const version = JSON.parse(raw).version;
    if (!version) throw new Error('no version field');
    pineUIVersion   = version;
    pineUIVersionAt = now;
    log.ok(`PineUI version resolved — ${c.cyan}${version}${c.reset}`);
    downloadPineUIBundle(version).catch(e => log.warn(`Bundle download failed: ${e.message}`));
  } catch (err) {
    log.warn(`npm version fetch failed (${err.message}) — ${pineUIVersion ? `using ${pineUIVersion}` : 'falling back to @latest'}`);
    if (!pineUIVersion) pineUIVersion = 'latest';
  }
  return pineUIVersion;
}

async function downloadPineUIBundle(version) {
  const jsFile  = join(PINEUI_DIR, `pineui-${version}.js`);
  const cssFile = join(PINEUI_DIR, `pineui-${version}.css`);

  const missing = !existsSync(jsFile) || !existsSync(cssFile);
  if (!missing) return; // already cached for this version

  const base = `https://unpkg.com/@pineui/react@${version}/dist`;
  log.info(`Downloading PineUI ${c.cyan}v${version}${c.reset} bundle from unpkg...`);

  const [js, css] = await Promise.all([
    fetchUrl(`${base}/pineui.standalone.js`),
    fetchUrl(`${base}/style.css`),
  ]);

  writeFileSync(jsFile,  js,  'utf8');
  writeFileSync(cssFile, css, 'utf8');
  log.ok(`PineUI bundle cached — ${c.dim}${js.length + css.length} bytes${c.reset}`);
}

async function getPineUIPrompt() {
  const now = Date.now();
  const age = now - pineUIPromptAt;

  if (pineUIPrompt && age < CACHE_TTL) {
    log.info(`Using cached PROMPT.md ${c.dim}(${pineUIPrompt.length} chars, ${Math.round(age / 1000)}s ago)${c.reset}`);
    return pineUIPrompt;
  }

  try {
    log.info('Fetching PineUI PROMPT.md from GitHub...');
    const fresh = await fetchUrl('https://raw.githubusercontent.com/PineUI/PineUI/main/PROMPT.md');
    pineUIPrompt   = fresh;
    pineUIPromptAt = now;
    writeFileSync(PROMPT_FILE, fresh, 'utf8');
    log.ok(`PineUI context loaded — ${c.dim}${pineUIPrompt.length} chars${c.reset}`);
  } catch (err) {
    if (pineUIPrompt) {
      log.warn(`GitHub fetch failed (${err.message}) — keeping in-memory cache`);
    } else if (existsSync(PROMPT_FILE)) {
      log.warn(`GitHub fetch failed (${err.message}) — using local PROMPT.md`);
      pineUIPrompt   = readFileSync(PROMPT_FILE, 'utf8');
      pineUIPromptAt = now;
      log.ok(`PineUI context loaded from disk — ${c.dim}${pineUIPrompt.length} chars${c.reset}`);
    } else {
      throw new Error(`Cannot load PineUI context: ${err.message}`);
    }
  }
  return pineUIPrompt;
}

function getDesignGuide() {
  if (!existsSync(DESIGN_FILE)) return '';
  return readFileSync(DESIGN_FILE, 'utf8');
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
    const pineContext  = await getPineUIPrompt();
    const designGuide  = getDesignGuide();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = [
      'You are an expert PineUI schema generator.',
      '',
      '## PineUI Component Documentation',
      pineContext,
      '',
      '---',
      '',
      designGuide,
      '',
      '---',
      '',
      '## Response Rules',
      '- Always respond with a valid PineUI JSON schema wrapped in a ```json code block',
      '- Before the JSON, write a brief 1–2 sentence description of what you built or changed',
      '- Never include any explanation after the JSON block',
      '- When the conversation history already contains a schema, make TARGETED changes — only modify what the user explicitly asks for. Preserve all other components, data, and structure.',
    ].join('\n');

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

app.get('/api/pineui-version', async (req, res) => {
  try {
    const version = await getPineUIVersion();
    const jsFile  = join(PINEUI_DIR, `pineui-${version}.js`);
    const cssFile = join(PINEUI_DIR, `pineui-${version}.css`);
    const local   = existsSync(jsFile) && existsSync(cssFile);
    res.json({
      version,
      js:  local ? `/pineui/pineui-${version}.js`  : `https://unpkg.com/@pineui/react@${version}/dist/pineui.standalone.js`,
      css: local ? `/pineui/pineui-${version}.css` : `https://unpkg.com/@pineui/react@${version}/dist/style.css`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  getPineUIPrompt().catch((err) => log.err(`Failed to preload PROMPT.md: ${err.message}`));
  getPineUIVersion().catch((err) => log.err(`Failed to resolve PineUI version: ${err.message}`));
  const design = getDesignGuide();
  if (design) log.ok(`Design guide loaded — ${c.dim}${design.length} chars${c.reset}`);
  else log.warn(`data/DESIGN.md not found — design guide will be empty`);
});
