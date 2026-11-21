import pg from 'pg';

export const { Client } = pg;

export function createPool(connectionString) {
  if (!connectionString) throw new Error('Falta DATABASE_URL.');
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
  pool.on('error', error => console.error('Conexión PostgreSQL interrumpida.', error.code ?? 'DB_ERROR'));
  return pool;
}

export async function transaction(pool, execute) {
  const db = await pool.connect();
  let discard = false;
  try {
    await db.query('BEGIN');
    const result = await execute(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await db.query('ROLLBACK');
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    db.release(discard);
  }
}
