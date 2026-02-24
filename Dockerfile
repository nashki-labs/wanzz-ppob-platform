# -- Build Stage (Frontend) --
FROM node:20-alpine AS builder
WORKDIR /app

# Copy client package files and install dependencies
COPY client/package*.json ./client/
RUN cd client && npm ci

# Copy client source and build
COPY client/ ./client/
# Note: vite.config.ts is configured to output to ../server/dist
RUN cd client && npm run build

# -- Production Stage --
FROM node:20-alpine AS production
WORKDIR /app

# Install native build tools for better-sqlite3
RUN apk add --no-cache python3 make g++

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy built frontend from builder to server/dist
COPY --from=builder /app/server/dist ./server/dist

# Copy remaining server files
COPY server/ ./server/

# Create data directory for SQLite
RUN mkdir -p /app/server/data

EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Run from server directory
WORKDIR /app/server

# Health check
HEALTHCHECK --interval=30s --timeout=3s CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
