This folder contains deployment helpers for running Climatus in production.

Instructions:

1) Build locally (or let CI build):
   - On CI: the workflow builds the client and server and saves server/dist as an artifact.
   - Locally: run `npm ci` and `npm run build` in repo root, then `cd server && npm ci && npm run build`.

2) Build Docker image:
   cd server
   docker build -t climatus-server .

3) Run with persistent DB:
   docker run -p 12000:3000 -v $(pwd)/server/data:/app/server/data --env PORT=3000 climatus-server

Notes:
- The container runs the compiled server (dist/server.js) in NODE_ENV=production.
- server/data must be mounted to persist the SQLite DB file.
