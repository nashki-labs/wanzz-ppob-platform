# -- Build Stage --
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# -- Production Stage --
FROM node:20-alpine AS production
WORKDIR /app

# Install native build tools for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server files
COPY server.js .
COPY database.js .
COPY routes/ ./routes/
COPY services/ ./services/
COPY utils/ ./utils/

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
