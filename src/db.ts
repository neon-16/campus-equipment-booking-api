import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BookingDatabase } from './database.js';
import type { Booking, BookingInput, Equipment } from './types.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(currentDirectory, '../migrations/001_initial.sql');

export class LocalBookingDatabase implements BookingDatabase {
  private readonly database: Database.Database;

  constructor(filename = ':memory:') {
    this.database = new Database(filename);
    this.database.pragma('foreign_keys = ON');
    this.database.exec(readFileSync(schemaPath, 'utf8'));
  }

  listEquipment(): Promise<Equipment[]> {
    return Promise.resolve(this.database.prepare('SELECT id, name, location FROM equipment ORDER BY id').all() as Equipment[]);
  }

  listBookings(): Promise<Booking[]> {
    const rows = this.database.prepare(`SELECT id, equipment_id AS equipmentId, borrower_name AS borrowerName,
      start_at AS startAt, end_at AS endAt, purpose FROM bookings ORDER BY start_at`).all() as Booking[];
    return Promise.resolve(rows);
  }

  getBooking(id: string): Promise<Booking | undefined> {
    const row = this.database.prepare(`SELECT id, equipment_id AS equipmentId, borrower_name AS borrowerName,
      start_at AS startAt, end_at AS endAt, purpose FROM bookings WHERE id = ?`).get(id) as Booking | undefined;
    return Promise.resolve(row);
  }

  hasEquipment(equipmentId: string): Promise<boolean> {
    return Promise.resolve(Boolean(this.database.prepare('SELECT 1 FROM equipment WHERE id = ?').get(equipmentId)));
  }

  hasConflict(input: BookingInput, excludedId?: string): Promise<boolean> {
    const query = excludedId
      ? `SELECT 1 FROM bookings WHERE equipment_id = ? AND start_at < ? AND end_at > ? AND id <> ?`
      : `SELECT 1 FROM bookings WHERE equipment_id = ? AND start_at < ? AND end_at > ?`;
    const parameters = excludedId
      ? [input.equipmentId, input.endAt, input.startAt, excludedId]
      : [input.equipmentId, input.endAt, input.startAt];
    return Promise.resolve(Boolean(this.database.prepare(query).get(...parameters)));
  }

  createBooking(id: string, input: BookingInput): Promise<void> {
    this.database.prepare(`INSERT INTO bookings
      (id, equipment_id, borrower_name, start_at, end_at, purpose)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, input.equipmentId, input.borrowerName, input.startAt, input.endAt, input.purpose);
    return Promise.resolve();
  }

  updateBooking(id: string, input: BookingInput): Promise<void> {
    this.database.prepare(`UPDATE bookings
      SET equipment_id = ?, borrower_name = ?, start_at = ?, end_at = ?, purpose = ?
      WHERE id = ?`)
      .run(input.equipmentId, input.borrowerName, input.startAt, input.endAt, input.purpose, id);
    return Promise.resolve();
  }

  deleteBooking(id: string): Promise<boolean> {
    const result = this.database.prepare('DELETE FROM bookings WHERE id = ?').run(id);
    return Promise.resolve(result.changes > 0);
  }

  close(): void {
    this.database.close();
  }
}

export function createDatabase(filename = ':memory:'): LocalBookingDatabase {
  return new LocalBookingDatabase(filename);
}
