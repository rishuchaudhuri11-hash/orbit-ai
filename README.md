# Orbit AI — Groq Chatbot Website

A responsive chatbot website with a polished dark UI, prompt suggestions, chat history for the current page session, copy-response buttons, and a server-side Groq API integration.

## Important deployment note

This project needs a **Node.js server** because the Groq API key must stay secret. It is not a static-only site and cannot be deployed as-is to a static-only Netlify Drop or GitHub Pages site. Use a Node-compatible host (for example, Render or Railway), or adapt `server.js` into your hosting provider's serverless functions.

## 1. Set up Groq

1. Open https://console.groq.com/
2. Create/copy an API key.
3. In your deployment host's environment-variable settings, add:
   - `GROQ_API_KEY` = your real key
   - `GROQ_MODEL` = `openai/gpt-oss-20b` (or another model currently available to your account)
4. Never share the real key, commit it to GitHub, or add it to frontend files.

## 2. Deploy on Render (beginner-friendly)

1. Upload this project to a new GitHub repository. Do not upload `.env` or any real API key.
2. Sign in at https://render.com/ and create a **Web Service** connected to that repository.
3. Set:
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Add `GROQ_API_KEY` and `GROQ_MODEL` in the service's Environment settings.
5. Deploy. Open the generated service URL and send a test message.

The `package.json` in this starter needs a start script; if you see an older version without it, add `"start": "node server.js"` to the scripts section. (The included current package file has this script.)

## 3. Run locally

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env
# Edit .env and put your key in GROQ_API_KEY
npm run build
npm start
```

Then open http://localhost:3000.

For local development with hot reload, use two terminals:
- Terminal 1: `node server.js`
- Terminal 2: `npm run dev`

Note: Vite dev server runs the frontend on port 5173, while the API server runs on port 3000. The included starter does not proxy `/api` from Vite automatically, so for simplest local testing use the production build commands above. You can add a Vite proxy if desired.

## Features

- Responsive mobile and desktop layout
- Groq-backed AI chat
- English/Hindi/Hinglish response matching (model-dependent)
- Suggested prompts
- Copy assistant responses
- Clear/new conversation
- Loading indicator and readable API errors
- API key kept server-side
- Basic input validation and conversation length limits

## Troubleshooting

- **401 / invalid key:** verify `GROQ_API_KEY` in host environment variables.
- **Model not found / 404:** select a model ID currently available to your Groq account in the Groq Console.
- **429 / rate limit:** check your account limits and usage.
- **Page loads but chat errors:** visit `/api/health` on the deployed domain; `configured` should be `true`.
- **Build or start failure:** ensure Node.js 20+ and that the host uses `npm install && npm run build` and `npm start`.

## Security and production hardening

This starter does not include user accounts, persistent server-side chat history, moderation, abuse-rate limiting, or paid-user billing. Add appropriate protections before exposing it to a large public audience.
