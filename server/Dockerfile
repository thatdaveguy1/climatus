# Build stage (build client + server)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy repo files
COPY . .

# Install root deps and build client
RUN npm ci && npm run build

# Install server deps and build server
WORKDIR /app/server
RUN npm ci && npm run build

# Production image
FROM node:20-alpine
WORKDIR /app

# Copy built server from builder
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/package*.json ./

# Install only production deps for server
RUN npm ci --production

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
