import { getPostgresConnection } from '../data-source';

async function setupRAG() {
    const ds = getPostgresConnection();
    try {
        await ds.initialize();
        console.log("Database initialized. Running schema updates...");

        await ds.query(`
            CREATE TABLE IF NOT EXISTS rag.deployment_kb_integration (
                id SERIAL PRIMARY KEY,
                deployment_id INTEGER NOT NULL REFERENCES infra_schema.infra_allocation(id),
                knowledge_base_id INTEGER NOT NULL REFERENCES rag.knowledge_base(id),
                is_active BOOLEAN DEFAULT TRUE,
                is_delete SMALLINT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Table rag.deployment_kb_integration created/verified.");

        await ds.query(`
            ALTER TABLE rag.knowledge_base_source_mapping 
            ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS next_sync_at TIMESTAMP;
        `);
        console.log("Table rag.knowledge_base_source_mapping updated.");

        await ds.destroy();
        console.log("Setup complete. Connection closed.");
    } catch (error) {
        console.error("Error setting up RAG tables:", error);
        process.exit(1);
    }
}

setupRAG();
