const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

let dbClient = null;
let isPostgresNative = false;

// Initialize Database (PGlite WASM or Native PostgreSQL Pool)
async function initDatabase() {
    if (dbClient) return dbClient;

    const useNativePostgres = process.env.USE_POSTGRES === 'true';

    if (useNativePostgres) {
        try {
            const { Pool } = require('pg');
            const poolConfig = process.env.DATABASE_URL
                ? { connectionString: process.env.DATABASE_URL }
                : {
                      host: process.env.PGHOST || 'localhost',
                      port: parseInt(process.env.PGPORT || '5432', 10),
                      user: process.env.PGUSER || 'postgres',
                      password: process.env.PGPASSWORD || 'postgres',
                      database: process.env.PGDATABASE || 'duolink_finance',
                  };

            const pool = new Pool(poolConfig);
            // Test connection
            const res = await pool.query('SELECT NOW()');
            console.log('Connected to Native PostgreSQL Server at:', res.rows[0].now);
            dbClient = {
                query: (text, params) => pool.query(text, params),
                pool,
            };
            isPostgresNative = true;
            return dbClient;
        } catch (err) {
            console.warn('Native PostgreSQL connection failed, falling back to embedded persistent PostgreSQL engine:', err.message);
        }
    }

    // Default & Zero-Config High Performance Engine: PGlite (Real PostgreSQL WASM)
    const { PGlite } = require('@electric-sql/pglite');
    const dataDir = path.resolve(__dirname, '../../data/postgres');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const pglite = new PGlite(dataDir);
    await pglite.waitReady;
    console.log('Embedded Persistent PostgreSQL engine ready at:', dataDir);

    dbClient = {
        query: async (text, params) => {
            const res = await pglite.query(text, params);
            return res;
        },
        pglite,
    };
    isPostgresNative = false;
    return dbClient;
}

// Unified Query Function
async function query(text, params = []) {
    if (!dbClient) {
        await initDatabase();
    }
    return dbClient.query(text, params);
}

// Transaction Helper
async function transaction(fn) {
    if (!dbClient) {
        await initDatabase();
    }
    if (isPostgresNative) {
        const client = await dbClient.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } else {
        // PGlite transaction
        return await dbClient.pglite.transaction(async (tx) => {
            return await fn(tx);
        });
    }
}

module.exports = {
    initDatabase,
    query,
    transaction,
    isNative: () => isPostgresNative,
};
