# Orbit AI Ultimate — v4.0

A modular multi-provider AI workspace built with React + TypeScript (Vite), Node.js/Express, Prisma, and PostgreSQL. It is designed to deploy as one Render web service while keeping provider secrets on the server.

## Included capabilities

- Account registration/login/logout, hashed passwords, random opaque HTTP-only session cookies, expiry, account deletion.
- PostgreSQL persistence for accounts, sessions, chats, messages, projects, documents, settings, feedback, and provider usage.
- Persistent chat history with per-user ownership checks, chat creation, pinning, archiving, deletion, search, and Markdown export.
- Parallel provider calls to Groq, Gemini, and OpenRouter; a configurable judge provider evaluates answers and produces a synthesis, scorecard, and a selected recommendation.
- Individual provider answers and errors are visible in the model-comparison panel. The app does not silently pretend a failed provider responded.
- Optional web research via Tavily with source URLs and snippets attached to the response.
- PDF, DOCX, TXT, MD, CSV, and JSON text extraction; selected files or project documents can provide context to a question.
- Optional Gemini image generation endpoint; browser voice input using the Web Speech API when supported by the user's browser.
- Math rendering (LaTeX/KaTeX), syntax-highlighted code, tables, links, feedback, copy, retry, responsive layout, light/dark/system theme, custom instructions, projects, usage visibility, and keyboard shortcuts.
- Security baseline: server-side API keys, bcrypt password hashing, session-token hashing in the database, HTTP-only cookies, secure cookies in production, Helmet headers, origin check, request limits, rate limits, Zod validation, upload limits, and ownership checks.

## Important scope note

This is an extensible product foundation, not a claim that every proprietary feature in every commercial chatbot has been cloned. Features such as fully autonomous computer use, guaranteed real-time voice conversations, arbitrary sandboxed Python execution, third-party OAuth connectors, video generation, shared team workspaces, billing, and production-grade vector search require additional providers, infrastructure, threat modelling, and testing. This version does not expose arbitrary code execution. Uploaded files are text-extracted, not OCR'd; scanned PDFs need OCR before they can be searched. Web research requires a Tavily key. Image generation requires a Gemini key and an image-capable model enabled for that key. Voice input depends on browser support.

## Local development

Requires Node.js 20+ and PostgreSQL.

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `SESSION_SECRET`, and provider keys.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Generate Prisma client and apply the schema:

   ```bash
   npm run db:generate
   npm run db:push
   ```

4. Start the frontend and API together:

   ```bash
   npm run dev
   ```

   Vite runs on its local development port and proxies `/api` to the Node server on port 10000.

5. For a production-style local build:

   ```bash
   npm run build
   npm start
   ```

## Render deployment

### 1. Database first

Create a PostgreSQL database in Render (or use an existing managed PostgreSQL provider). Copy its **internal** connection URL into the web service environment variable `DATABASE_URL` when the database and web service are in the same Render region. Ensure SSL is configured as required by your database provider.

Do not rely on the web service's ephemeral filesystem for user history. PostgreSQL is the durable store in this project.

### 2. Connect the GitHub repository

Create or open a Render **Web Service** connected to the repository containing this project. If the repository root contains `package.json`, use:

- **Build Command:** `npm install --include=dev && npm run db:generate && npm run build`
- **Start Command:** `npm run db:migrate && npm start`
- **Runtime:** Node

If you have the project inside a subfolder, set that folder as the Render Root Directory.

### 3. Set environment variables

Required:

- `NODE_ENV=production`
- `APP_ORIGIN=https://YOUR-SERVICE.onrender.com` (exact public origin, no trailing slash)
- `DATABASE_URL` (Render PostgreSQL internal URL)
- `SESSION_SECRET` (random secret at least 32 characters)
- At least one provider key; for your requested three-way comparison, configure all three:
  - `GROQ_API_KEY`
  - `GEMINI_API_KEY`
  - `OPENROUTER_API_KEY`

Recommended:

- `GROQ_MODEL=openai/gpt-oss-20b`
- `GEMINI_MODEL=gemini-3.8-flash` (confirm availability in your Google AI Studio account; model IDs can change)
- `OPENROUTER_MODEL=openai/gpt-oss-20b` (choose a model actually available to your OpenRouter account)
- `JUDGE_PROVIDER=groq`
- `JUDGE_MODEL=openai/gpt-oss-20b`
- `TAVILY_API_KEY` for web research
- `GEMINI_IMAGE_MODEL=gemini-2.5-flash-image` if this model is enabled for your key
- `MAX_UPLOAD_MB=12`
- `DAILY_MESSAGE_LIMIT=150`

**Never** put API keys in `VITE_*` variables or commit `.env` to GitHub. The browser calls only your backend.

### 4. Verify deployment

After deploy, open `/api/health`. It should return `ok: true` and list which provider keys are configured (only provider IDs, never key values). Then test:

1. Register an account.
2. Start a chat and ask a normal question.
3. Open the model-comparison panel; confirm all three provider results or explicit errors appear.
4. Refresh and confirm history persists.
5. Test math such as `\int_0^1 x^2 dx` and check it renders as math.
6. Upload a text-based PDF or DOCX and ask a question using its content.
7. Enable web research after setting `TAVILY_API_KEY`.
8. Restart/redeploy the service and confirm chats remain because they live in PostgreSQL.

## API overview

- `GET /api/health`, `GET /api/config`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `DELETE /api/account`
- `GET/PATCH /api/settings`
- `GET/POST /api/chats`, `GET/PATCH/DELETE /api/chats/:id`, `POST /api/chats/:id/messages`
- `POST /api/messages/:id/feedback`
- `GET/POST/PATCH/DELETE /api/projects`
- `GET/POST/DELETE /api/documents`
- `POST /api/image/generate`, `GET /api/usage`

## Security and production checklist

Before inviting real users, use a managed PostgreSQL database with backups, rotate secrets, add email verification and password reset, configure an email provider, add a formal privacy policy and retention policy, perform dependency and security scans, test rate limits and abuse controls, set budget/usage alerts at each AI provider, and run end-to-end tests under provider failures. The simple per-account daily quota in this starter counts user messages; it is not a cost-aware token budget. The judge model call is an extra API call when comparison is enabled.

## Troubleshooting

- **`DATABASE_URL` error:** set the correct managed PostgreSQL URL, then redeploy.
- **No model responds:** check `/api/health`, Render environment variables, provider account credits/limits, and Render logs.
- **Only one provider returns:** the other provider's API key/model may be invalid or unavailable; its explicit error appears in the comparison panel.
- **No web sources:** configure `TAVILY_API_KEY` and enable Web in the composer.
- **Image generation fails:** check the Gemini model's image-output support and access for your API key.
- **History disappears after restart:** verify `DATABASE_URL` points to persistent PostgreSQL and that the service did not fall back to a temporary/local database.
- **Deploy fails on Prisma:** ensure the build command runs `npm run db:generate` and the start command runs `npm run db:migrate`.

## Research references

The feature roadmap was informed by official product documentation, not by copying proprietary code:

- OpenAI ChatGPT capabilities: https://help.openai.com/en/articles/9260256-chatgpt-capabilities-overview
- OpenAI projects: https://help.openai.com/en/articles/10169521-projects-in-chatgpt
- OpenAI file uploads: https://help.openai.com/en/articles/8555545-uploading-files-and-audio
- OpenAI data analysis: https://help.openai.com/en/articles/8437071-data-analysis-with-chatgpt
- Claude artifacts: https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them
- Claude research: https://support.claude.com/en/articles/11088861-use-research-on-claude
- Perplexity product overview: https://www.perplexity.ai/hub
- Gemini API capabilities: https://ai.google.dev/api/generate-content
- Groq chat completion docs: https://console.groq.com/docs/text-chat
