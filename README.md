# Q0-Application-Service

Backend service for the Q0 platform (Node.js + Express + TypeScript). This document explains the repository layout (focus on src/), conventions, and how to run the service.

## Quick Summary
- **Tech Stack**: Node.js + TypeScript, Express.js, TypeORM, PostgreSQL, JWT Authentication
- **Project Root**: Contains build config files (tsconfig.json), lint config, database config, and Kubernetes manifests in k8-files/
- **Main Backend Source**: src/ — described below
- **Database**: PostgreSQL with TypeORM for ORM
- **Authentication**: JWT-based with role management

## Run / Build

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
npm start
```

### Docker Build & Run
```bash
docker build -t q0-application-service .
docker run -p 3000:3000 q0-application-service
```

Adjust environment variables (Database connection, JWT secret, AWS credentials, etc.) in your `.env` file.

## src — Project Source Overview
This README provides a concise overview of the src/ folder structure and conventions for the Q0-Application-Service project.

### Purpose
src/ contains the Express.js application source: controllers, services, entities, middleware, and core utilities. The project uses a modular architecture with feature-based controllers and shared services.

### Top-level Quick Map
- `app.ts` — application bootstrap and middleware setup
- `server.ts` — HTTP server initialization
- `config.ts` — configuration management
- `controllers/` — feature-level request handlers
- `services/` — business logic implementation
- `entities/` — database models and schemas
- `core/` — shared utilities and base classes
- `middlewares/` — request processing middleware
- `database/` — database configuration and repositories

### Core Components
- `core/` — shared foundation:
  - `ApiError.ts` — error handling
  - `ApiResponse.ts` — response formatting
  - `AppRoutes.ts` — route configuration
  - `AwsService.ts` — AWS integration
  - Other utilities and helpers

### Controllers (API Endpoints)
Feature-based controllers under controllers/:
- `allocation/` — resource allocation endpoints
- `model/` — model management APIs
- `cloudAccount/` — cloud integration
- `deployment/` — deployment management
- And many other feature-specific controllers

### Business Logic
- `services/` — core business logic
- `entities/` — TypeORM entities
- `database/` — Data access layer and validation

## Conventions & Best Practices

### Code Organization
- Controllers handle HTTP layer (validation, response formatting)
- Services contain business logic
- Repositories handle data access
- Entities define database schema
- Middleware for cross-cutting concerns

### File Naming
- Controllers: `*.controller.ts`
- Services: `*.service.ts`
- Entities: `*Entity.ts`
- Middleware: `*Middleware.ts`

### Development Guidelines
- Keep controllers thin, move logic to services
- Use TypeORM repositories for database operations
- Follow REST API conventions
- Implement proper error handling
- Use dependency injection patterns

For detailed project structure information, see [FileStructure.md](FileStructure.md).

## Key Features
- Cloud Resource Management
- Model Deployment and Training
- User Authentication and Authorization
- Company and Member Management
- Hardware Resource Allocation
- Cloud Provider Integration
- API Key Management
- Dataset Management

## Configuration
Configure through environment variables in `.env`:
```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=q0_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key
```

## Quick Tasks
- To add a new API endpoint: Create controller in `controllers/<feature>/`, implement service in `services/`, and wire routes in `AppRoutes.ts`
- To add shared utilities: Create or update in `core/`
- To add new database table: Create entity in `entities/` and repository in `database/repository/`
- To add middleware: Add to `middlewares/` and wire in `app.ts`