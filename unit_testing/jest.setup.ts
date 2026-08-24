/**
 * Jest global setup - mocks TypeORM's DataSource and BaseEntity methods
 * so tests never attempt real database connections.
 */

// Mock the database module so no real connection is attempted
jest.mock('../src/database/database', () => ({
    __esModule: true,
    default: {
        getInstance: jest.fn().mockReturnValue({
            connectToDB: jest.fn().mockResolvedValue(undefined),
            executeExternalQuery: jest.fn().mockResolvedValue([]),
        }),
    },
}));

jest.mock('../src/database/data-source', () => ({
    getPostgresConnection: jest.fn().mockReturnValue({
        initialize: jest.fn().mockResolvedValue(undefined),
        manager: {
            query: jest.fn().mockResolvedValue([]),
        },
    }),
}));

// Mock reflect-metadata (needed for TypeORM decorators)
import 'reflect-metadata';
