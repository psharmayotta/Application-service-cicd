# Q0-Application-Service File Structure

This document provides a detailed breakdown of the project's file structure and organization.

## Project Root Layout
```
├── Dockerfile_App_Service    # Docker configuration
├── nodemon.json             # Development server config
├── package.json            # Dependencies and scripts
├── q0ErDiagram.dbml        # Database schema diagram
├── tsconfig.json          # TypeScript configuration
└── k8-files/              # Kubernetes deployment files
    ├── Chart.yaml         # Helm chart metadata
    ├── values.yaml        # Environment values
    └── templates/         # K8s manifests
```

## Source Code Organization (src/)

### Core Files
```
src/
├── app.ts                # App initialization
├── config.ts            # Configuration
├── server.ts           # HTTP server
└── kafkatest.js       # Kafka testing
```

### Feature Controllers
```
controllers/
├── baseController.controller.ts  # Base controller
├── allocation/                  # Resource allocation
│   ├── allocation.controller.ts
├── cloudAccount/               # Cloud management
│   ├── cloudAccount.controller.ts
├── model/                     # Model management
│   ├── model.controller.ts
└── [Other feature controllers]
```

### Core Utilities
```
core/
├── ApiError.ts           # Error handling
├── ApiResponse.ts        # Response formatting
├── AppRoutes.ts         # Route definitions
├── AwsService.ts        # AWS integration
├── MetaModel.ts         # Model metadata
└── [Other utilities]
```

### Database Layer
```
database/
├── data-source.ts       # Database config
├── database.ts         # DB initialization
└── repository/        # Data access layer and validation
    ├── model
    |    |--model.model.ts
    |    |--model.dto.ts
    └── [Other repositories]
```

### Entity Definitions
```
entities/
├── allocationEntity.ts          # Resource allocation
├── cloudAccountEntity.ts        # Cloud accounts
├── modelEntity.ts              # AI models
├── userEntity.ts              # User management
└── [Other entities]           # Database schemas
```

### Services Layer
```
services/
├── model/
│   ├── model.service.ts
├── cloud/
│   ├── cloud.service.ts
└── [Other services]
```

## Directory Structure Notes

### Controllers Directory
- One controller per feature
- Validation files alongside controllers
- Type definitions when needed
- Base controller for common operations

### Services Directory
- Business logic implementation
- Service interfaces for dependency injection
- Utility functions for the service
- Type definitions for the service

### Entities Directory
- One entity per database table
- Relationships defined using decorators
- Validation rules using class-validator
- Custom repository methods when needed

### Core Directory
- Shared utilities and helpers
- Base classes and interfaces
- Common types and constants
- Error handling utilities

## Best Practices

### File Organization
1. Group related files in feature directories
2. Keep consistent file naming
3. Use index files for exports
4. Maintain proper separation of concerns

### Code Structure
1. Imports
2. Constants/Types
3. Class/Function definitions
4. Exports

### Naming Conventions
- Controllers: `*.controller.ts`
- Services: `*.service.ts`
- Entities: `*Entity.ts`
- Types: `*.types.ts`
- Tests: `*.spec.ts`

For more information about the application itself, refer to [README.md](README.md).
