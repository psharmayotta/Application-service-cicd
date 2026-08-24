import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { getPostgresConnection } from './data-source';

class Database {
    private static instance: Database;
    private postgresConnection: DataSource | null = null;
    private entityManager: EntityManager | null = null;


    static getInstance(): Database {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }

    /**
     * Connect to the Postgres database with connection pooling
     */
    async connectToDB(): Promise<void> {
        if (!this.postgresConnection) {
            this.postgresConnection = getPostgresConnection();
            try {
                await this.postgresConnection.initialize();
                this.entityManager = this.postgresConnection.manager;

                console.log(`Connected to Postgres DB with user q0admin `);
            } catch (error) {
                console.error('Error connecting to Postgres DB:', error);
                throw error;
            }
        }
    }

    /**
     * Execute an external SQL query with transaction handling
     */
    public async executeExternalQuery(query: string, params: any[] = []): Promise<any> {
        if (!this.entityManager) {
            throw new Error("Database connection not established!");
        }
        try {
            const result = await this.entityManager.query(query, params);
            return Promise.resolve(result);
        } catch (error) {
            console.error("Error executing query:", error);
            return Promise.reject(error);
        }
    }
}

export default Database;
