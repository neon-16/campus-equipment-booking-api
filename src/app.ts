import { Hono } from 'hono';
import type { BookingInput } from './types.js';
import type { BookingDatabase } from './database.js';

type JsonRecord = Record<string, unknown>;

const bookingFields = ['equipmentId', 'borrowerName', 'startAt', 'endAt', 'purpose'] as const;

function errorResponse(message: string, status: 400 | 404 | 409 | 500) {
  return Response.json({ error: message }, { status });
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

function parseJsonBody(body: unknown): JsonRecord | Response {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return errorResponse('Request body must be a JSON object', 400);
  }
  return body as JsonRecord;
}

export function createApp(database: BookingDatabase) {
  const app = new Hono();

  app.get('/api/equipment', async (context) => {
    return context.json(await database.listEquipment());
  });

  app.get('/api/bookings', async (context) => {
    return context.json(await database.listBookings());
  });

  app.get('/api/bookings/:id', async (context) => {
    const booking = await database.getBooking(context.req.param('id'));
    return booking ? context.json(booking) : errorResponse('Booking not found', 404);
  });

  app.post('/api/bookings', async (context) => {
    const parsedBody = parseJsonBody(await context.req.json().catch(() => null));
    if (parsedBody instanceof Response) return parsedBody;
    const validationError = validateInput(parsedBody, false);
    if (validationError) return errorResponse(validationError, 400);

    const input = getBookingInput(parsedBody);
    if (!(await database.hasEquipment(input.equipmentId))) return errorResponse('Equipment not found', 404);
    if (await database.hasConflict(input)) return errorResponse('Booking conflicts with an existing booking', 409);

    const id = crypto.randomUUID();
    await database.createBooking(id, input);
    return context.json({ id, ...input }, 201);
  });

  app.patch('/api/bookings/:id', async (context) => {
    const bookingId = context.req.param('id');
    const current = await database.getBooking(bookingId);
    if (!current) return errorResponse('Booking not found', 404);

    const parsedBody = parseJsonBody(await context.req.json().catch(() => null));
    if (parsedBody instanceof Response) return parsedBody;
    const validationError = validateInput(parsedBody, true);
    if (validationError) return errorResponse(validationError, 400);

    const input: BookingInput = {
      equipmentId: String(parsedBody.equipmentId ?? current.equipmentId),
      borrowerName: String(parsedBody.borrowerName ?? current.borrowerName),
      startAt: new Date(String(parsedBody.startAt ?? current.startAt)).toISOString(),
      endAt: new Date(String(parsedBody.endAt ?? current.endAt)).toISOString(),
      purpose: String(parsedBody.purpose ?? current.purpose),
    };
    if (Date.parse(input.startAt) >= Date.parse(input.endAt)) return errorResponse('startAt must be before endAt', 400);
    if (!(await database.hasEquipment(input.equipmentId))) return errorResponse('Equipment not found', 404);
    if (await database.hasConflict(input, current.id)) return errorResponse('Booking conflicts with an existing booking', 409);

    await database.updateBooking(current.id, input);
    return context.json({ id: current.id, ...input });
  });

  app.delete('/api/bookings/:id', async (context) => {
    const deleted = await database.deleteBooking(context.req.param('id'));
    return deleted ? new Response(null, { status: 204 }) : errorResponse('Booking not found', 404);
  });

  app.onError((error, context) => {
    console.error(error);
    return errorResponse('Internal server error', 500);
  });

  return app;
}
