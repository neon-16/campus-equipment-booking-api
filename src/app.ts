import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { Booking, BookingInput, Equipment } from './types.js';

type AppVariables = {
  db: Database.Database;
};

type JsonRecord = Record<string, unknown>;

const bookingFields = ['equipmentId', 'borrowerName', 'startAt', 'endAt', 'purpose'] as const;

function errorResponse(message: string, status: 400 | 404 | 409 | 500) {
  return Response.json({ error: message }, { status });
}

function asBooking(row: Record<string, unknown>): Booking {
  return {
    id: String(row.id),
    equipmentId: String(row.equipment_id),
    borrowerName: String(row.borrower_name),
    startAt: String(row.start_at),
    endAt: String(row.end_at),
    purpose: String(row.purpose),
  };
}

function asEquipment(row: Record<string, unknown>): Equipment {
  return {
    id: String(row.id),
    name: String(row.name),
    location: String(row.location),
  };
}

function validateInput(value: unknown, partial: boolean): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return 'Request body must be a JSON object';
  }

  const body = value as JsonRecord;
  const fields = partial
    ? bookingFields.filter((field) => field in body)
    : [...bookingFields];

  if (fields.length === 0) {
    return 'At least one booking field is required';
  }

  for (const field of fields) {
    if (typeof body[field] !== 'string' || body[field].trim() === '') {
      return `${field} must be a non-empty string`;
    }
  }

  if ('startAt' in body && Number.isNaN(Date.parse(String(body.startAt)))) {
    return 'startAt must be a valid date-time';
  }
  if ('endAt' in body && Number.isNaN(Date.parse(String(body.endAt)))) {
    return 'endAt must be a valid date-time';
  }

  if ('startAt' in body && 'endAt' in body && Date.parse(String(body.startAt)) >= Date.parse(String(body.endAt))) {
    return 'startAt must be before endAt';
  }

  return null;
}

function getBookingInput(body: JsonRecord): BookingInput {
  return {
    equipmentId: String(body.equipmentId),
    borrowerName: String(body.borrowerName),
    startAt: new Date(String(body.startAt)).toISOString(),
    endAt: new Date(String(body.endAt)).toISOString(),
    purpose: String(body.purpose),
  };
}

function hasEquipment(db: Database.Database, equipmentId: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM equipment WHERE id = ?').get(equipmentId));
}

function hasConflict(db: Database.Database, input: BookingInput, excludedId?: string): boolean {
  const query = excludedId
    ? `SELECT 1 FROM bookings
       WHERE equipment_id = ? AND start_at < ? AND end_at > ? AND id <> ?`
    : `SELECT 1 FROM bookings
       WHERE equipment_id = ? AND start_at < ? AND end_at > ?`;
  const parameters = excludedId
    ? [input.equipmentId, input.endAt, input.startAt, excludedId]
    : [input.equipmentId, input.endAt, input.startAt];
  return Boolean(db.prepare(query).get(...parameters));
}

function parseJsonBody(body: unknown): JsonRecord | Response {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return errorResponse('Request body must be a JSON object', 400);
  }
  return body as JsonRecord;
}

export function createApp(database: Database.Database) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use('*', async (context, next) => {
    context.set('db', database);
    await next();
  });

  app.get('/api/equipment', (context) => {
    const rows = database.prepare('SELECT id, name, location FROM equipment ORDER BY id').all() as Record<string, unknown>[];
    return context.json(rows.map(asEquipment));
  });

  app.get('/api/bookings', (context) => {
    const rows = database.prepare('SELECT * FROM bookings ORDER BY start_at').all() as Record<string, unknown>[];
    return context.json(rows.map(asBooking));
  });

  app.get('/api/bookings/:id', (context) => {
    const row = database.prepare('SELECT * FROM bookings WHERE id = ?').get(context.req.param('id')) as Record<string, unknown> | undefined;
    return row ? context.json(asBooking(row)) : errorResponse('Booking not found', 404);
  });

  app.post('/api/bookings', async (context) => {
    const parsedBody = parseJsonBody(await context.req.json().catch(() => null));
    if (parsedBody instanceof Response) return parsedBody;
    const validationError = validateInput(parsedBody, false);
    if (validationError) return errorResponse(validationError, 400);

    const input = getBookingInput(parsedBody);
    if (!hasEquipment(database, input.equipmentId)) return errorResponse('Equipment not found', 404);
    if (hasConflict(database, input)) return errorResponse('Booking conflicts with an existing booking', 409);

    const id = randomUUID();
    database.prepare(`INSERT INTO bookings
      (id, equipment_id, borrower_name, start_at, end_at, purpose)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, input.equipmentId, input.borrowerName, input.startAt, input.endAt, input.purpose);
    return context.json({ id, ...input }, 201);
  });

  app.patch('/api/bookings/:id', async (context) => {
    const existingRow = database.prepare('SELECT * FROM bookings WHERE id = ?').get(context.req.param('id')) as Record<string, unknown> | undefined;
    if (!existingRow) return errorResponse('Booking not found', 404);

    const parsedBody = parseJsonBody(await context.req.json().catch(() => null));
    if (parsedBody instanceof Response) return parsedBody;
    const validationError = validateInput(parsedBody, true);
    if (validationError) return errorResponse(validationError, 400);

    const current = asBooking(existingRow);
    const input: BookingInput = {
      equipmentId: String(parsedBody.equipmentId ?? current.equipmentId),
      borrowerName: String(parsedBody.borrowerName ?? current.borrowerName),
      startAt: new Date(String(parsedBody.startAt ?? current.startAt)).toISOString(),
      endAt: new Date(String(parsedBody.endAt ?? current.endAt)).toISOString(),
      purpose: String(parsedBody.purpose ?? current.purpose),
    };
    if (Date.parse(input.startAt) >= Date.parse(input.endAt)) return errorResponse('startAt must be before endAt', 400);
    if (!hasEquipment(database, input.equipmentId)) return errorResponse('Equipment not found', 404);
    if (hasConflict(database, input, current.id)) return errorResponse('Booking conflicts with an existing booking', 409);

    database.prepare(`UPDATE bookings SET equipment_id = ?, borrower_name = ?, start_at = ?, end_at = ?, purpose = ? WHERE id = ?`)
      .run(input.equipmentId, input.borrowerName, input.startAt, input.endAt, input.purpose, current.id);
    return context.json({ id: current.id, ...input });
  });

  app.delete('/api/bookings/:id', (context) => {
    const result = database.prepare('DELETE FROM bookings WHERE id = ?').run(context.req.param('id'));
    return result.changes === 0 ? errorResponse('Booking not found', 404) : new Response(null, { status: 204 });
  });

  app.onError((error, context) => {
    console.error(error);
    return errorResponse('Internal server error', 500);
  });

  return app;
}
