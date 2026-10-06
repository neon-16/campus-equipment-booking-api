import type { Booking, BookingInput, Equipment } from './types.js';

export interface BookingDatabase {
  listEquipment(): Promise<Equipment[]>;
  listBookings(): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking | undefined>;
  hasEquipment(equipmentId: string): Promise<boolean>;
  hasConflict(input: BookingInput, excludedId?: string): Promise<boolean>;
  createBooking(id: string, input: BookingInput): Promise<void>;
  updateBooking(id: string, input: BookingInput): Promise<void>;
  deleteBooking(id: string): Promise<boolean>;
}