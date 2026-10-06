import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(currentDirectory, '../migrations/001_initial.sql');

export function createDatabase(filename = ':memory:'): Database.Database {
  const database = new Database(filename);
  database.pragma('foreign_keys = ON');
  database.exec(readFileSync(schemaPath, 'utf8'));
  return database;
}
