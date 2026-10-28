# Security notes

- API keys are read by the Node server only. Do not expose them to the Vite browser bundle.
- Passwords are hashed with bcryptjs (12 rounds). Session cookies are HTTP-only, SameSite=Lax, Secure in production, and contain a random opaque token; only its SHA-256 hash is stored in PostgreSQL.
- Protected database records are queried with the authenticated user ID. Uploaded document retrieval checks ownership.
- JSON request bodies are size-limited; upload size/count and file types are restricted; common endpoints are rate-limited; request bodies are schema-validated.
- Helmet adds security headers and the server checks the configured application origin for API requests.
- Do not run untrusted generated code on the application server. This project deliberately does not provide arbitrary code execution.

This is a security baseline, not a formal audit. Before a public launch, add email verification, password reset, stronger CSRF strategy appropriate to any future cross-origin architecture, automated dependency scanning, security review, backups, abuse/cost monitoring, retention controls, and integration tests.
