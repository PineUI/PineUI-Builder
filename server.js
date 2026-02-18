import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import https from 'https';
import rateLimit from 'express-rate-limit';

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

app.use(express.json());
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

## STRICT COMPONENT CONTRACT — verified against real SDK demos

### Layout
- layout.column — props: children, padding, spacing, mainAxisAlignment, crossAxisAlignment, width, height, flex, backgroundColor, borderRadius, overflow, borderRight, borderLeft, borderTop, borderBottom
- layout.row — same props as layout.column
- layout.scaffold — props: body, floatingActionButton, appBar, bottomNav

### Display
- text — props: content, style, color, fontWeight, fontSize, lineHeight, align
  - style values: titleLarge, titleMedium, titleSmall, bodyLarge, bodyMedium, bodySmall, headlineLarge, headlineMedium, headlineSmall, labelLarge, labelMedium, labelSmall, displayLarge, displayMedium, displaySmall
  - color values: "primary", "onSurfaceVariant", "error", "success", or any hex string like "#49454F"
- image — props: src (NOT url), width, height, fit, borderRadius, aspectRatio
- avatar — props: src (NOT url), size
- card — props: child (singular, NOT children), elevation, padding, backgroundColor, borderRadius, onPress, onTap, width, height
- badge — props: label, color, variant, size
- chip — props: label, selected, onPress
- divider — props: spacing
- progress — props: value, label, color  (only "progress", NOT "progress.linear" or "progress.circular")
- tabs — props: tabs (array of {id, label, badge?, content}), defaultTab
- table — props: columns (array of {key, label, width?, template?}), data

### Buttons
- button.filled — props: label, icon, onPress, disabled, fullWidth
- button.text — props: label, icon, onPress, disabled, fullWidth
- button.icon — props: icon, size, color, label, onPress, disabled
- button.fab — props: icon, label, onPress, disabled

### Input
- input.text — props: id, placeholder, value, multiline, maxLines, maxLength, autofocus, flex, borderRadius, onChanged
  (this is the ONLY input type — do NOT use input.email, input.password, input.number, input.textarea)

### Collections & Conditional
- collection — props: id, layout ("list"|"grid"), columns, spacing, itemSpacing, virtualized, data, itemTemplate (NOT template), loadingState, emptyState, errorState
- conditionalRender — props: conditions (array of {when: "{{expr}}", render: ComponentNode})

### Overlays
- Defined in "overlays" key at schema root, NOT inline
- overlay type: "overlay.modal" with props: presentation ("modal"|"bottomSheet"), dismissible, child
- Open: action.overlay.open — props: overlayId
- Close: action.overlay.close — props: overlayId

### Actions
- action.http — props: method, url, body, onSuccess (NOT "action.http.request")
- action.state.patch — props: path, value
- action.overlay.open — props: overlayId
- action.overlay.close — props: overlayId
- action.snackbar.show — props: message, duration
- action.delay — props: duration
- action.sequence — props: actions (array of action objects)
- action.collection.refresh — props: collectionId

### Intents
- Define in "intents" key: {"intentName": {"handler": ActionNode | ActionNode[]}}
- Call with shorthand object: {"intent": "intentName", "param": "value"}
- Do NOT use {"type": "intent", "name": "..."} — that is NOT supported

NEVER invent component or action types. NEVER use input.email, input.password, input.number. NEVER use action.http.request. NEVER use template instead of itemTemplate. NEVER use url instead of src on image/avatar.

---

RESPONSE RULES:
- Always respond with a valid PineUI JSON schema wrapped in a \`\`\`json code block
- Before the JSON, write a brief 1-2 sentence description of what you built
- Never include any explanation after the JSON block
- Use realistic, meaningful data in your schemas
- Make the UI visually rich and complete`;

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

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log(`  ${c.bold}${c.green}🍍 PineUI Builder${c.reset}`);
  console.log(`  ${c.dim}Running at${c.reset} ${c.cyan}http://localhost:${PORT}${c.reset}`);
  console.log(`  ${c.dim}Rate limit: 10 req/min per IP${c.reset}`);
  console.log('');
  getPineUIPrompt().catch((err) => log.err(`Failed to preload context: ${err.message}`));
});
