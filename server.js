import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import https from 'https';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Rate limit: 10 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment before trying again.' },
});

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
    console.log('Fetching PineUI PROMPT.md from GitHub...');
    pineUIPrompt = await fetchPineUIPrompt();
    console.log('PineUI context loaded.');
  }
  return pineUIPrompt;
}

app.post('/api/generate', limiter, async (req, res) => {
  const { prompt, history = [] } = req.body;

  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const pineContext = await getPineUIPrompt();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `You are an expert PineUI schema generator. Use the following PineUI documentation to generate valid JSON schemas.

${pineContext}

IMPORTANT RULES:
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

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Error calling Claude API:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`PineUI Builder running at http://localhost:${PORT}`);
  getPineUIPrompt().catch(console.error);
});
