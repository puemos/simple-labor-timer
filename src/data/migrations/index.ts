import { SQLiteDatabase } from 'expo-sqlite';
import { initialMigrationSql } from '@/data/migrations/001_initial';

const SCHEMA_VERSION = '1';

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(initialMigrationSql);
  await db.runAsync(
    'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
    'schema_version',
    SCHEMA_VERSION,
  );
}
