import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createDatabase, type LocalBookingDatabase } from '../src/db.js';

let database: LocalBookingDatabase;

afterEach(() => database?.close());

function setup() {
  database = createDatabase();
  return createApp(database);
}

const validBooking = {
  equipmentId: 'eq-1',
  borrowerName: 'Somchai Jaidee',
  startAt: '2026-10-20T09:00:00.000Z',
  endAt: '2026-10-20T11:00:00.000Z',
  purpose: 'Class presentation',
};

describe('equipment and bookings API', () => {
  it('lists seeded equipment', async () => {
    const response = await setup().request('/api/equipment');
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(2);
  });

  it('creates, reads, updates, and deletes a booking', async () => {
    const app = setup();
    const created = await app.request('/api/bookings', { method: 'POST', body: JSON.stringify(validBooking), headers: { 'Content-Type': 'application/json' } });
    expect(created.status).toBe(201);
    const booking = await created.json() as { id: string };

    expect((await app.request(`/api/bookings/${booking.id}`)).status).toBe(200);
    const updated = await app.request(`/api/bookings/${booking.id}`, { method: 'PATCH', body: JSON.stringify({ purpose: 'Updated presentation' }), headers: { 'Content-Type': 'application/json' } });
    expect(updated.status).toBe(200);
    expect((await updated.json() as { purpose: string }).purpose).toBe('Updated presentation');

    expect((await app.request(`/api/bookings/${booking.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await app.request(`/api/bookings/${booking.id}`)).status).toBe(404);
  });

  it('rejects invalid times and missing equipment', async () => {
    const app = setup();
    const invalid = await app.request('/api/bookings', { method: 'POST', body: JSON.stringify({ ...validBooking, endAt: validBooking.startAt }), headers: { 'Content-Type': 'application/json' } });
    expect(invalid.status).toBe(400);
    expect((await invalid.json() as { error: string }).error).toContain('before');

    const missingEquipment = await app.request('/api/bookings', { method: 'POST', body: JSON.stringify({ ...validBooking, equipmentId: 'eq-missing' }), headers: { 'Content-Type': 'application/json' } });
    expect(missingEquipment.status).toBe(404);
  });

  it('rejects overlapping bookings on POST and PATCH', async () => {
    const app = setup();
    await app.request('/api/bookings', { method: 'POST', body: JSON.stringify(validBooking), headers: { 'Content-Type': 'application/json' } });
    const overlap = await app.request('/api/bookings', { method: 'POST', body: JSON.stringify({ ...validBooking, borrowerName: 'Another Borrower', startAt: '2026-10-20T10:00:00.000Z', endAt: '2026-10-20T12:00:00.000Z' }), headers: { 'Content-Type': 'application/json' } });
    expect(overlap.status).toBe(409);

    const other = await app.request('/api/bookings', { method: 'POST', body: JSON.stringify({ ...validBooking, equipmentId: 'eq-2' }), headers: { 'Content-Type': 'application/json' } });
    const otherBooking = await other.json() as { id: string };
    const patch = await app.request(`/api/bookings/${otherBooking.id}`, { method: 'PATCH', body: JSON.stringify({ equipmentId: 'eq-1' }), headers: { 'Content-Type': 'application/json' } });
    expect(patch.status).toBe(409);
  });
});
