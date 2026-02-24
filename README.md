# WANZZ PPOB PLATFORM v2.1
### *Official Documentation - Enterprise Digital Product Hub*

---

## 🏗️ Architectural Overview
The platform has evolved from a simple monolithic design into a sophisticated **Monorepo** architecture leveraging the **Routes-Controller-Services (RCS)** design pattern. This transition ensures code modularity, enhanced testability, and a clear separation between raw business logic and HTTP orchestration.

### 📁 Project Structure
```text
wanzz-ppob-refactor/
├── client/                 # [React 19 + Vite] - Modern Frontend
│   ├── src/
│   │   ├── components/     # Atomic UI components
│   │   ├── pages/          # View orchestrators
│   │   ├── services/       # Frontend API clients (api.ts)
│   │   └── types/          # Shared TypeScript definitions
│   └── vite.config.ts      # Proxy & Build configuration
├── server/                 # [Node.js + Express] - Backend Engine
│   ├── routes/             # THIN: Just route definitions & middleware
│   ├── controllers/        # RESPONSE: Request parsing & status returning
│   ├── services/           # BUSINESS: Core logic (Payment, Pterodactyl)
│   ├── middlewares/        # SECURITY: Auth, Rate Limiting, Validation
│   └── database.js         # PERSISTENCE: SQLite + WAL management
├── Dockerfile              # Multi-stage optimized production build
├── .env.example            # Template for mandatory secrets
└── package.json            # Monorepo workspace manager
```

---

## 🚀 Unified Monorepo Management
Control the entire environment from the root directory using these helper scripts:

| Command | Action |
| :--- | :--- |
| `npm run install:all` | Installs dependencies for Root, Client, and Server in one go. |
| `npm run dev` | Spins up Vite (:5173) and Express (:3000) concurrently. |
| `npm run build` | Compiles Frontend Assets into the Server's distribution folder. |
| `npm run start` | Boots the production server serving both API and Frontend. |

---

## 🛡️ Security Implementation
- **JWT Authentication**: Cross-layer stateless sessions with 30-day persistence.
- **Bcrypt Hashing**: Adaptive industrial-grade password salting.
- **Rate Limiting**: Protection against brute-force attacks on Auth and API endpoints.
- **Atomic Transactions**: Balance integrity ensured via SQLite's `runInTransaction` logic, preventing race conditions during concurrent orders.
- **Environment Isolation**: Mandatory secret management via `.env` files.

---

## 📡 API Layer Breakdown (RCS Example)
When a user purchases a Pterodactyl Panel, the request flows through these distinct layers:
1. **Route** (`pterodactyl.routes.js`): Intercepts the request and checks for a valid JWT via `authenticateToken`.
2. **Controller** (`pterodactyl.controller.js`): Validates input, handles balance checks, and prepares the response.
3. **Service** (`pterodactyl.service.js`): Executes actual API calls to the Pterodactyl panel and updates the database.

---

## ⚙️ Environment Configuration
Create a `.env` file in the root based on `.env.example`:

| Variable | Description |
| :--- | :--- |
| `CIAA_API_KEY` | Your token for PPOB product fulfillment. |
| `PAKASIR_API_KEY` | Your token for the Pakasir Payment Gateway. |
| `PTERO_PLTA_API_KEY` | Admin API key for Pterodactyl Panel orchestration. |
| `TELEGRAM_BOT_TOKEN` | Bot token for instant admin system alerts. |
| `JWT_SECRET` | Cryptographic secret for session signing (KEEP PRIVATE). |

---

## 🐳 Deployment & Production

### Automated VPS Deployment
The project includes a `deploy.sh` script that automates the transfer of files and the rebuilding of containers on your VPS:
```bash
chmod +x deploy.sh
./deploy.sh <VPS_IP> <SSH_PORT>
```

### Manual Docker Build
```bash
docker compose up -d --build
```

---

**Built with Precision & Performance**  
*The Nashki Labs Engineering Team*
