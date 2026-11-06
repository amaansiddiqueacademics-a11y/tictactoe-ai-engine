# Security

This is an academic project, but security reports are welcome. Please open a GitHub issue, or for anything sensitive email amaan.siddique.academics@gmail.com instead of posting details publicly.

When deploying:

- Set a long random `JWT_SECRET` (the server refuses to start in production without one) and a strong `POSTGRES_PASSWORD`.
- Serve over HTTPS so WebSocket traffic uses WSS.
- Keep Redis and PostgreSQL off the public network (Docker Compose already does this).
