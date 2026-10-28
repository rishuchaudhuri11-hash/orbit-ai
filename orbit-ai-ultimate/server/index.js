import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import { compareAnswers, generateImage, hashToken, randomToken, searchWeb, providerConfig } from './ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const prisma = new PrismaClient();
const isProd = process.env.NODE_ENV === 'production';
if (isProd && (!process.env.DATABASE_URL || !process.env.APP_ORIGIN || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) { console.error('Production startup requires DATABASE_URL, exact APP_ORIGIN, and SESSION_SECRET of at least 32 characters.'); process.exit(1); }
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'], fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net', 'data:'], imgSrc: ["'self'", 'data:', 'blob:', 'https:'], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
const appOrigin = process.env.APP_ORIGIN;
app.use(cors({ origin: appOrigin || false, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many authentication attempts. Try again later.' } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 90, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api', apiLimiter);
const cookieName = isProd ? '__Host-orbit_session' : 'orbit_session';
const cookieOpts = { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 1000 * 60 * 60 * 24 * 30 };

function ensureOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin && appOrigin && origin !== appOrigin) return res.status(403).json({ error: 'Request origin is not allowed.' });
  next();
}
app.use('/api', ensureOrigin);

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies[cookieName];
    if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
    const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: { settings: true } } } });
    if (!session || session.expiresAt <= new Date()) {
      if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      res.clearCookie(cookieName, { ...cookieOpts, maxAge: undefined });
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    req.user = session.user;
    req.sessionId = session.id;
    next();
  } catch (e) { next(e); }
}
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const signupSchema = z.object({ name: z.string().trim().min(1).max(80), email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), password: z.string().min(10).max(128) });
const loginSchema = z.object({ email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), password: z.string().min(1).max(128) });
const settingsSchema = z.object({ theme: z.enum(['light', 'dark', 'system']).optional(), language: z.enum(['auto', 'en', 'hi', 'hinglish']).optional(), defaultMode: z.enum(['single', 'compare']).optional(), compareEnabled: z.boolean().optional(), webSearch: z.boolean().optional(), systemPrompt: z.string().max(4000).optional() }).strict();
const messageSchema = z.object({ content: z.string().trim().min(1).max(20000), compare: z.boolean().optional(), webSearch: z.boolean().optional(), documentIds: z.array(z.string().max(100)).max(10).optional() }).strict();

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'Orbit AI', version: '4.0.0', configuredProviders: providerConfig().filter(p => p.key).map(p => p.id), timestamp: new Date().toISOString() }));
app.get('/api/config', (_req, res) => res.json({ providers: providerConfig().map(p => ({ id: p.id, label: p.label, configured: Boolean(p.key), model: p.model })), features: { comparison: true, projects: true, fileContext: true, webResearch: Boolean(process.env.TAVILY_API_KEY), imageGeneration: Boolean(process.env.GEMINI_API_KEY), voiceInput: true, export: true }, limits: { maxUploadMB: Number(process.env.MAX_UPLOAD_MB || 12), dailyMessages: Number(process.env.DAILY_MESSAGE_LIMIT || 150) } }));

app.post('/api/auth/register', authLimiter, asyncRoute(async (req, res) => {
  const parsed = signupSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid signup details.' });
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });
  const user = await prisma.user.create({ data: { name: parsed.data.name, email: parsed.data.email, passwordHash: await bcrypt.hash(parsed.data.password, 12), settings: { create: {} } } });
  const token = randomToken(); await prisma.session.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + cookieOpts.maxAge) } });
  res.cookie(cookieName, token, cookieOpts); res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, settings: user.settings } });
}));
app.post('/api/auth/login', authLimiter, asyncRoute(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, include: { settings: true } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  const token = randomToken(); await prisma.session.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + cookieOpts.maxAge) } });
  res.cookie(cookieName, token, cookieOpts); res.json({ user: { id: user.id, name: user.name, email: user.email, settings: user.settings } });
}));
app.post('/api/auth/logout', requireAuth, asyncRoute(async (req, res) => { await prisma.session.delete({ where: { id: req.sessionId } }).catch(() => {}); res.clearCookie(cookieName, { ...cookieOpts, maxAge: undefined }); res.json({ ok: true }); }));
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, settings: req.user.settings } }));
app.delete('/api/account', requireAuth, asyncRoute(async (req, res) => { await prisma.user.delete({ where: { id: req.user.id } }); res.clearCookie(cookieName, { ...cookieOpts, maxAge: undefined }); res.json({ ok: true }); }));

app.get('/api/settings', requireAuth, asyncRoute(async (req, res) => {
  const settings = req.user.settings || await prisma.userSettings.create({ data: { userId: req.user.id } }); res.json({ settings });
}));
app.patch('/api/settings', requireAuth, asyncRoute(async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid settings.' });
  const settings = await prisma.userSettings.upsert({ where: { userId: req.user.id }, create: { userId: req.user.id, ...parsed.data }, update: parsed.data }); res.json({ settings });
}));

app.get('/api/chats', requireAuth, asyncRoute(async (req, res) => {
  const chats = await prisma.chat.findMany({ where: { userId: req.user.id, ...(req.query.archived === 'true' ? { archived: true } : { archived: false }) }, orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }], take: 150, select: { id: true, title: true, projectId: true, pinned: true, archived: true, createdAt: true, updatedAt: true, _count: { select: { messages: true } } } }); res.json({ chats });
}));
app.post('/api/chats', requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({ title: z.string().trim().max(120).optional(), projectId: z.string().optional().nullable() }); const parsed = schema.safeParse(req.body || {}); if (!parsed.success) return res.status(400).json({ error: 'Invalid chat details.' });
  if (parsed.data.projectId) { const project = await prisma.project.findFirst({ where: { id: parsed.data.projectId, userId: req.user.id } }); if (!project) return res.status(404).json({ error: 'Project not found.' }); }
  const chat = await prisma.chat.create({ data: { userId: req.user.id, title: parsed.data.title || 'New conversation', projectId: parsed.data.projectId || null } }); res.status(201).json({ chat });
}));
app.get('/api/chats/:id', requireAuth, asyncRoute(async (req, res) => {
  const chat = await prisma.chat.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { messages: { orderBy: { createdAt: 'asc' }, take: 300 }, project: { select: { id: true, name: true, instructions: true } } } }); if (!chat) return res.status(404).json({ error: 'Chat not found.' }); res.json({ chat });
}));
app.patch('/api/chats/:id', requireAuth, asyncRoute(async (req, res) => {
  const parsed = z.object({ title: z.string().trim().min(1).max(120).optional(), pinned: z.boolean().optional(), archived: z.boolean().optional(), projectId: z.string().nullable().optional() }).strict().safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid chat update.' });
  const own = await prisma.chat.findFirst({ where: { id: req.params.id, userId: req.user.id } }); if (!own) return res.status(404).json({ error: 'Chat not found.' });
  if (parsed.data.projectId) { const p = await prisma.project.findFirst({ where: { id: parsed.data.projectId, userId: req.user.id } }); if (!p) return res.status(404).json({ error: 'Project not found.' }); }
  const chat = await prisma.chat.update({ where: { id: own.id }, data: parsed.data }); res.json({ chat });
}));
app.delete('/api/chats/:id', requireAuth, asyncRoute(async (req, res) => { const r = await prisma.chat.deleteMany({ where: { id: req.params.id, userId: req.user.id } }); if (!r.count) return res.status(404).json({ error: 'Chat not found.' }); res.json({ ok: true }); }));

app.post('/api/chats/:id/messages', requireAuth, asyncRoute(async (req, res) => {
  const parsed = messageSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid message.' });
  const chat = await prisma.chat.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { project: true } }); if (!chat) return res.status(404).json({ error: 'Chat not found.' });
  const dailyLimit = Number(process.env.DAILY_MESSAGE_LIMIT || 150); const since = new Date(); since.setHours(0, 0, 0, 0);
  const used = await prisma.message.count({ where: { chat: { userId: req.user.id }, role: 'user', createdAt: { gte: since } } }); if (used >= dailyLimit) return res.status(429).json({ error: `Daily message limit (${dailyLimit}) reached. Try again tomorrow.` });
  const question = parsed.data.content;
  const history = await prisma.message.findMany({ where: { chatId: chat.id }, orderBy: { createdAt: 'desc' }, take: 20 }); history.reverse();
  const userMessage = await prisma.message.create({ data: { chatId: chat.id, role: 'user', content: question } });
  if (history.length === 0 && chat.title === 'New conversation') await prisma.chat.update({ where: { id: chat.id }, data: { title: question.slice(0, 64) + (question.length > 64 ? '…' : '') } });
  let webResults = [];
  if (parsed.data.webSearch ?? req.user.settings?.webSearch) {
    try { const result = await searchWeb(question); webResults = result.results; }
    catch (e) { webResults = []; }
  }
  let context = '';
  const ids = parsed.data.documentIds || [];
  if (ids.length) {
    const docs = await prisma.document.findMany({ where: { id: { in: ids }, userId: req.user.id, OR: [{ projectId: chat.projectId }, { projectId: null }] }, select: { name: true, textContent: true } });
    context = docs.map(d => `DOCUMENT: ${d.name}\n${d.textContent.slice(0, 8000)}`).join('\n\n').slice(0, 18000);
  } else if (chat.projectId) {
    const docs = await prisma.document.findMany({ where: { userId: req.user.id, projectId: chat.projectId }, take: 4, orderBy: { createdAt: 'desc' }, select: { name: true, textContent: true } });
    context = docs.map(d => `PROJECT DOCUMENT: ${d.name}\n${d.textContent.slice(0, 2500)}`).join('\n\n').slice(0, 9000);
  }
  try {
    const started = Date.now();
    const result = await compareAnswers({ question, history: history.map(m => ({ role: m.role, content: m.content })), context, webResults, systemPrompt: [req.user.settings?.language && req.user.settings.language !== 'auto' ? `Respond in ${req.user.settings.language === 'hi' ? 'Hindi' : req.user.settings.language === 'hinglish' ? 'Hinglish' : 'English'} unless the user asks otherwise.` : '', req.user.settings?.systemPrompt, chat.project?.instructions].filter(Boolean).join('\n\n'), compare: parsed.data.compare ?? true });
    const metadata = { winner: result.winner, winnerModel: result.winnerModel, arbitration: result.arbitration, providers: result.providers.map(p => ({ provider: p.provider, label: p.label, model: p.model, latencyMs: p.latencyMs, error: p.error || null, content: p.content || null })), webResults: result.webResults, contextUsed: result.contextUsed, generatedAt: result.generatedAt };
    const assistantMessage = await prisma.message.create({ data: { chatId: chat.id, role: 'assistant', content: result.answer, metadata } });
    await prisma.chat.update({ where: { id: chat.id }, data: { updatedAt: new Date() } });
    await prisma.usageLog.createMany({ data: result.providers.map(p => ({ userId: req.user.id, provider: p.provider, model: p.model, inputChars: question.length, outputChars: (p.content || '').length, latencyMs: p.latencyMs || 0, success: !p.error })) });
    res.json({ userMessage, assistantMessage, result: metadata, elapsedMs: Date.now() - started });
  } catch (e) {
    await prisma.message.create({ data: { chatId: chat.id, role: 'system', content: `Request failed: ${String(e.message || e).slice(0, 500)}`, metadata: { error: true } } }).catch(() => {});
    res.status(502).json({ error: String(e.message || 'AI providers failed').slice(0, 900), userMessage });
  }
}));
app.post('/api/messages/:id/feedback', requireAuth, asyncRoute(async (req, res) => {
  const parsed = z.object({ rating: z.number().int().min(-1).max(1), note: z.string().max(1000).optional().default('') }).safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid feedback.' });
  const msg = await prisma.message.findFirst({ where: { id: req.params.id, chat: { userId: req.user.id } } }); if (!msg) return res.status(404).json({ error: 'Message not found.' });
  await prisma.feedback.create({ data: { userId: req.user.id, chatId: msg.chatId, messageId: msg.id, ...parsed.data } }); res.json({ ok: true });
}));

app.get('/api/projects', requireAuth, asyncRoute(async (req, res) => { const projects = await prisma.project.findMany({ where: { userId: req.user.id }, orderBy: { updatedAt: 'desc' }, include: { _count: { select: { chats: true, documents: true } } } }); res.json({ projects }); }));
app.post('/api/projects', requireAuth, asyncRoute(async (req, res) => { const p = z.object({ name: z.string().trim().min(1).max(100), instructions: z.string().max(4000).optional().default(''), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#6c63ff') }).safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Enter a project name.' }); const project = await prisma.project.create({ data: { userId: req.user.id, ...p.data } }); res.status(201).json({ project }); }));
app.patch('/api/projects/:id', requireAuth, asyncRoute(async (req, res) => { const p = z.object({ name: z.string().trim().min(1).max(100).optional(), instructions: z.string().max(4000).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }).strict().safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Invalid project update.' }); const owned = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.user.id } }); if (!owned) return res.status(404).json({ error: 'Project not found.' }); const project = await prisma.project.update({ where: { id: owned.id }, data: p.data }); res.json({ project }); }));
app.delete('/api/projects/:id', requireAuth, asyncRoute(async (req, res) => { const r = await prisma.project.deleteMany({ where: { id: req.params.id, userId: req.user.id } }); if (!r.count) return res.status(404).json({ error: 'Project not found.' }); res.json({ ok: true }); }));

const maxUpload = Math.max(1, Number(process.env.MAX_UPLOAD_MB || 12)) * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUpload, files: 5 }, fileFilter: (_req, file, cb) => { const allowed = ['application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']; cb(allowed.includes(file.mimetype) || /\.(pdf|txt|md|csv|json|docx)$/i.test(file.originalname) ? null : new Error('Unsupported file type. Upload PDF, DOCX, TXT, MD, CSV, or JSON.'), allowed.includes(file.mimetype) || /\.(pdf|txt|md|csv|json|docx)$/i.test(file.originalname)); } });
app.post('/api/documents', requireAuth, upload.array('files', 5), asyncRoute(async (req, res) => {
  const files = req.files || []; if (!files.length) return res.status(400).json({ error: 'Choose at least one file.' });
  const projectId = req.body.projectId || null; if (projectId && !(await prisma.project.findFirst({ where: { id: projectId, userId: req.user.id } }))) return res.status(404).json({ error: 'Project not found.' });
  const created = [];
  for (const file of files) {
    let text = '';
    try {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === '.pdf' || file.mimetype === 'application/pdf') text = (await pdfParse(file.buffer)).text;
      else if (ext === '.docx') text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
      else text = file.buffer.toString('utf8');
    } catch { return res.status(400).json({ error: `Could not read ${file.originalname}. It may be scanned or damaged.` }); }
    text = text.replace(/\u0000/g, '').slice(0, 200000);
    if (!text.trim()) return res.status(400).json({ error: `${file.originalname} has no extractable text. Scanned PDFs need OCR before upload.` });
    created.push(await prisma.document.create({ data: { userId: req.user.id, projectId, name: path.basename(file.originalname).slice(0, 255), mimeType: file.mimetype, sizeBytes: file.size, textContent: text } }));
  }
  res.status(201).json({ documents: created.map(d => ({ id: d.id, name: d.name, sizeBytes: d.sizeBytes, projectId: d.projectId, createdAt: d.createdAt })) });
}));
app.get('/api/documents', requireAuth, asyncRoute(async (req, res) => { const documents = await prisma.document.findMany({ where: { userId: req.user.id, ...(typeof req.query.projectId === 'string' ? { projectId: req.query.projectId } : {}) }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, mimeType: true, sizeBytes: true, projectId: true, createdAt: true } }); res.json({ documents }); }));
app.delete('/api/documents/:id', requireAuth, asyncRoute(async (req, res) => { const r = await prisma.document.deleteMany({ where: { id: req.params.id, userId: req.user.id } }); if (!r.count) return res.status(404).json({ error: 'Document not found.' }); res.json({ ok: true }); }));

app.post('/api/image/generate', requireAuth, asyncRoute(async (req, res) => { const parsed = z.object({ prompt: z.string().trim().min(3).max(2000) }).safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Enter an image prompt.' }); const image = await generateImage(parsed.data.prompt); res.json(image); }));
app.get('/api/usage', requireAuth, asyncRoute(async (req, res) => { const since = new Date(); since.setHours(0, 0, 0, 0); const [messages, logs] = await Promise.all([prisma.message.count({ where: { chat: { userId: req.user.id }, role: 'user', createdAt: { gte: since } } }), prisma.usageLog.findMany({ where: { userId: req.user.id, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 100 })]); res.json({ messagesToday: messages, dailyLimit: Number(process.env.DAILY_MESSAGE_LIMIT || 150), providers: providerConfig().map(p => ({ id: p.id, label: p.label, configured: Boolean(p.key), model: p.model })), recent: logs.slice(0, 30).map(l => ({ provider: l.provider, model: l.model, latencyMs: l.latencyMs, success: l.success, createdAt: l.createdAt })) }); }));

app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use((err, _req, res, _next) => { const status = err?.code === 'LIMIT_FILE_SIZE' ? 413 : err?.name === 'MulterError' ? 400 : 500; if (status === 500) console.error('[orbit-error]', err?.message || err); res.status(status).json({ error: status === 500 ? 'Unexpected server error. Check Render logs for details.' : String(err?.message || 'Request failed').slice(0, 500) }); });

const clientDist = path.resolve(__dirname, '../dist/client');
app.use(express.static(clientDist, { maxAge: isProd ? '1h' : 0, index: false }));
app.get('/{*path}', (_req, res) => res.sendFile(path.join(clientDist, 'index.html'), err => { if (err && !res.headersSent) res.status(404).send('Orbit AI frontend has not been built yet. Run npm run build.'); }));

const port = Number(process.env.PORT || 10000);
const server = app.listen(port, () => console.log(`Orbit AI listening on ${port}`));
async function shutdown() { server.close(); await prisma.$disconnect(); process.exit(0); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
