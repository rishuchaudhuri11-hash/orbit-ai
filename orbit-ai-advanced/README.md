# Orbit AI Advanced — Groq-powered chatbot

A full-stack Node.js chatbot starter that implements the four roadmap phases in one project: streaming AI responses; authenticated accounts and persistent chat history; web research and document-grounded answers; and basic usage/security controls. It is a serious starter, not a security-audited commercial SaaS product.

## Included

- Groq Chat Completions API with streaming SSE, stop, retries via re-send, model configuration, language selection (Auto/English/Hindi/Hinglish), response modes.
- Email/password sign-up and login; password hashing with Node's `scrypt`; HttpOnly, SameSite session cookie; logout and account deletion.
- SQLite persistence for users, sessions, chats, messages, uploaded-document text, feedback and daily usage.
- Conversation list, rename-ready API, delete and reopen chats.
- Optional web research through Tavily (`TAVILY_API_KEY`); sources are passed to the model and citations are requested.
- PDF, DOCX, TXT and Markdown upload, text extraction, user-owned document selection and lightweight keyword-based retrieval (RAG-style).
- Rate limiting, payload limits, input validation, daily message quota, Helmet security headers, ownership checks, and health/config endpoints.
- Responsive UI, Markdown/code display, copy response, feedback buttons, language/mode settings and mobile sidebar.

## Important limitations

- Research mode requires a separate Tavily API key. Groq alone does not provide a general web-search key in this app.
- Uploaded documents are stored as extracted text in SQLite. Retrieval is keyword-based, not embedding/vector semantic search. It is a starter RAG implementation.
- The app uses a single SQLite file and one Node process. For a multi-instance production service, migrate to managed PostgreSQL and use a mature auth provider such as Supabase Auth with Row Level Security. Do not horizontally scale this SQLite version.
- SQLite file persistence on Render requires a paid persistent disk (or switch to managed Postgres). Render's default filesystem is ephemeral. See https://render.com/docs/disks.
- This app has no email verification, password reset, OAuth, billing, moderation provider, malware scanning, enterprise audit trail, or formal security audit. Add these before a public commercial launch.
- The server stores document text, so don't upload confidential or sensitive documents unless your deployment/storage/security requirements have been reviewed.
- The default model ID is a configurable example. Model availability changes; choose a currently supported model in your Groq Console if needed.

## Environment variables

Copy `.env.example` to `.env` locally, then configure:

- `GROQ_API_KEY` — required. Create it at https://console.groq.com/keys
- `GROQ_MODEL` — model available to your Groq account, e.g. `openai/gpt-oss-20b` only if currently available.
- `TAVILY_API_KEY` — optional, enables web research mode. Obtain from https://app.tavily.com/
- `DB_PATH` — default `./data/orbit.sqlite`. On a Render disk mounted at `/var/data`, set `/var/data/orbit.sqlite`.
- `DAILY_MESSAGE_LIMIT` — default 100 messages per account per UTC day.
- `NODE_ENV=production` enables Secure session cookies and production proxy handling.
- `PORT` — supplied by the hosting platform.

Never commit `.env` or expose `GROQ_API_KEY` in frontend code.

## Run locally

Requires Node.js 20+ and npm.

```bash
npm install
cp .env.example .env
# Edit .env and set GROQ_API_KEY (and optional TAVILY_API_KEY)
npm start
```

Open http://localhost:3000. Create an account, then test a chat. The first account is not a special admin; each user only sees their own chats and documents.

## Deploy to Render

1. Upload all files in this project to a GitHub repository. Do not upload `.env`, `node_modules`, or database files.
2. In Render, create **New → Web Service** connected to the repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Set environment variables in Render:
   - `GROQ_API_KEY` = your secret Groq key
   - `GROQ_MODEL` = an available model ID
   - `NODE_ENV` = `production`
   - `DB_PATH` = `/var/data/orbit.sqlite` (if using a persistent disk)
   - `TAVILY_API_KEY` = optional search key
6. To persist accounts/chats/documents, add a persistent disk mounted at `/var/data` and use a plan that supports disks. Without a persistent disk or external database, SQLite data can be lost on redeploy/restart. Render disk docs: https://render.com/docs/disks
7. Deploy. Check `https://YOUR-SERVICE.onrender.com/api/health`; `groqConfigured` should be true and `webResearchConfigured` is true only if Tavily is configured.
8. Test sign-up, send a message, refresh and reopen the conversation, upload a text-based PDF, and test research mode if configured.

## Deployment verification checklist

- [ ] `npm install` completes successfully on host.
- [ ] `/api/health` reports `groqConfigured: true`.
- [ ] Sign-up and login work over HTTPS.
- [ ] A Groq response streams into the UI.
- [ ] Chat remains after page refresh and service restart (requires persistent storage).
- [ ] User A cannot open User B's chat/document IDs.
- [ ] File size/type limits work.
- [ ] Research mode only appears available when `TAVILY_API_KEY` is set.
- [ ] Daily quota and rate limits work as intended.

## API endpoints

- `GET /api/health`, `GET /api/config`
- `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/chats`, `POST /api/chats`, `GET/PATCH/DELETE /api/chats/:id`
- `POST /api/chat` — authenticated SSE stream
- `GET/POST/DELETE /api/documents` (delete by ID at `/api/documents/:id`)
- `GET /api/usage`, `POST /api/feedback`, `DELETE /api/account`

## Troubleshooting

- **401 from Groq:** verify the key in host environment settings and redeploy.
- **404/model error:** choose a model currently available to your account.
- **429:** Groq or local quota/rate limits reached; review the relevant usage page.
- **Research unavailable:** add `TAVILY_API_KEY` and redeploy.
- **History disappears after deploy:** configure a persistent disk and `DB_PATH`, or migrate to a managed database.
- **PDF upload has no text:** scanned PDFs require OCR, which is not included in this starter.
- **SQLite native module build error:** use Node 20+ and let the host run `npm install`; check build logs.
