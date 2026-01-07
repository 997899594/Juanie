# AI Platform - Phase 1 MVP

Gemini-powered DevOps & SRE Agent with Tool-Driven Dynamic UI.

## Features

- 🤖 **AI Chat**: Powered by Google Gemini (Flash + Pro models)
- 🛠️ **Tool-Driven UI**: Dynamic component rendering based on tool calls
- 💾 **Context Caching**: Redis-based caching for fast context retrieval
- ✅ **Deterministic Validation**: kubeval, conftest, shellcheck integration
- 👤 **HITL Approval**: Human-in-the-loop for critical operations
- 🔒 **Safety Guardrails**: Lakera Guard integration
- 📊 **Observability**: Prometheus metrics + Audit logs
- 🏢 **Multi-tenant**: Complete tenant isolation

## Tech Stack

### Backend
- **Framework**: NestJS + Fastify
- **AI SDK**: Vercel AI SDK (`ai` + `@ai-sdk/google`)
- **Cache**: Redis (ioredis)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: kubeval, conftest, shellcheck
- **Safety**: Lakera Guard
- **Metrics**: Prometheus

### Frontend
- **Framework**: Vue 3 + TypeScript
- **AI Integration**: `@ai-sdk/vue`
- **State**: Pinia
- **UI**: shadcn-vue + Tailwind CSS
- **Router**: Vue Router

## Getting Started

### Prerequisites

- Node.js >= 22.0.0
- Bun >= 1.0.0
- Redis
- PostgreSQL
- Gemini API Key
- Lakera Guard API Key (optional)

### Installation

```bash
# Install dependencies
bun install

# Copy environment variables
cp .env.example .env

# Edit .env and fill in your API keys
```

### Development

```bash
# Start the backend
bun run dev

# The server will start on http://localhost:3001
```

### Environment Variables

See `.env.example` for all available configuration options.

## Project Structure

```
apps/ai-platform/
├── src/
│   ├── ai/                 # AI chat & tool execution
│   │   ├── controllers/    # HTTP controllers
│   │   ├── services/       # Business logic
│   │   └── dto/           # Data transfer objects
│   ├── kubernetes/        # K8s integration & validation
│   ├── audit/             # Audit logs & metrics
│   ├── common/            # Shared modules (Redis, etc.)
│   ├── app.module.ts      # Root module
│   └── main.ts            # Application entry point
├── package.json
├── tsconfig.json
└── README.md
```

## API Endpoints

### Chat
- `POST /api/ai/chat` - Stream AI chat with tool execution

### Health
- `GET /health` - Health check endpoint

### Metrics
- `GET /metrics` - Prometheus metrics

## Testing

```bash
# Run unit tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test -- --coverage
```

## Architecture

See [design.md](../../.kiro/specs/ai-platform-phase1/design.md) for detailed architecture documentation.

## License

MIT
