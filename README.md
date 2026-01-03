# Space Le Farm - Bill App

A PWA bill management app for Le Farm shop with Cloudflare Workers backend and D1 database.

## Architecture

- **Frontend**: Next.js 16 with React 19, deployed on Vercel
- **Backend**: Cloudflare Workers with Hono.js
- **Database**: Cloudflare D1 (SQLite)

## Development Setup

### 1. Backend (Cloudflare Worker)

```bash
cd worker

# Install dependencies
npm install

# Login to Cloudflare (first time only)
npx wrangler login

# Create D1 database (first time only)
npm run db:create
# Copy the database_id to wrangler.toml

# Initialize local database with schema
npm run db:init

# Start development server (http://localhost:8787)
npm run dev
```

### 2. Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local file
echo "NEXT_PUBLIC_API_URL=http://localhost:8787" > .env.local

# Start development server (http://localhost:3000)
npm run dev
```

## Deployment

### Deploy Worker to Cloudflare

```bash
cd worker

# Initialize remote database (first time only)
npm run db:init:remote

# Deploy
npm run deploy
```

### Deploy Frontend to Vercel

1. Push to GitHub
2. Connect repository to Vercel
3. Set environment variable: `NEXT_PUBLIC_API_URL=https://your-worker.workers.dev`

## API Endpoints

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/products` | GET, POST | Products CRUD |
| `/api/products/:id` | GET, PUT, DELETE | Single product |
| `/api/units` | GET, POST | Units CRUD |
| `/api/units/:id` | PUT, DELETE | Single unit |
| `/api/customers` | GET, POST | Customers CRUD |
| `/api/customers/:id` | PUT, DELETE | Single customer |
| `/api/settings` | GET, PUT | Shop settings |
| `/api/health` | GET | Health check |
