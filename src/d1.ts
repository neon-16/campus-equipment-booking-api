import type { Booking, BookingInput, Equipment } from './types.js';
import type { BookingDatabase } from './database.js';

export class D1BookingDatabase implements BookingDatabase {
  constructor(private readonly database: D1Database) {}

  async listEquipment(): Promise<Equipment[]> {
    const result = await this.database
      .prepare('SELECT id, name, location FROM equipment ORDER BY id')
      .all<Equipment>();
    return result.results;
  }

  async listBookings(): Promise<Booking[]> {
    const result = await this.database
      .prepare(`SELECT id, equipment_id AS equipmentId, borrower_name AS borrowerName,
        start_at AS startAt, end_at AS endAt, purpose FROM bookings ORDER BY start_at`)
      .all<Booking>();
    return result.results;
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    const booking = await this.database
      .prepare(`SELECT id, equipment_id AS equipmentId, borrower_name AS borrowerName,
        start_at AS startAt, end_at AS endAt, purpose FROM bookings WHERE id = ?`)
      .bind(id)
      .first<Booking>();
    return booking ?? undefined;
  }

  async hasEquipment(equipmentId: string): Promise<boolean> {
    const row = await this.database
      .prepare('SELECT 1 AS found FROM equipment WHERE id = ?')
      .bind(equipmentId)
      .first<{ found: number }>();
    return row !== null;
  }

  async hasConflict(input: BookingInput, excludedId?: string): Promise<boolean> {
    const statement = excludedId
      ? this.database.prepare(`SELECT 1 AS found FROM bookings
          WHERE equipment_id = ? AND start_at < ? AND end_at > ? AND id <> ?`)
        .bind(input.equipmentId, input.endAt, input.startAt, excludedId)
      : this.database.prepare(`SELECT 1 AS found FROM bookings
          WHERE equipment_id = ? AND start_at < ? AND end_at > ?`)
        .bind(input.equipmentId, input.endAt, input.startAt);
    return (await statement.first<{ found: number }>()) !== null;
  }

  async createBooking(id: string, input: BookingInput): Promise<void> {
    await this.database.prepare(`INSERT INTO bookings
      (id, equipment_id, borrower_name, start_at, end_at, purpose)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, input.equipmentId, input.borrowerName, input.startAt, input.endAt, input.purpose)
      .run();
  }

  async updateBooking(id: string, input: BookingInput): Promise<void> {
    await this.database.prepare(`UPDATE bookings
      SET equipment_id = ?, borrower_name = ?, start_at = ?, end_at = ?, purpose = ?
      WHERE id = ?`)
      .bind(input.equipmentId, input.borrowerName, input.startAt, input.endAt, input.purpose, id)
      .run();
  }

  async deleteBooking(id: string): Promise<boolean> {
    const result = await this.database
      .prepare('DELETE FROM bookings WHERE id = ?')
      .bind(id)
      .run();
    return result.meta.changes > 0;
  }
}