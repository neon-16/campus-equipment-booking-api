# API Contract and Test Evidence

Local base URL: `http://localhost:8787/api`

Deployed Cloudflare base URL: `https://campus-equipment-booking-api.neon-dev.workers.dev/api`

## Equipment

### `GET /equipment`

Returns `200` and an array of equipment objects:

```json
[
  { "id": "eq-1", "name": "Projector A", "location": "Building 1" },
  { "id": "eq-2", "name": "Camera Kit B", "location": "Media Lab" }
]
```

## Bookings

### `GET /bookings`

Returns `200` and an array of bookings.

### `GET /bookings/:id`

Returns `200` and one booking, or `404`:

```json
{ "error": "Booking not found" }
```

### `POST /bookings`

Request fields are all required: `equipmentId`, `borrowerName`, `startAt`, `endAt`, and `purpose`. Returns `201` with the generated `id` and booking fields.

### `PATCH /bookings/:id`

Accepts one or more booking fields and returns `200` with the complete updated booking. Returns `404` if the ID does not exist.

### `DELETE /bookings/:id`

Returns `204` on success and `404` if the ID does not exist.

## Status codes

| Status | Meaning |
| --- | --- |
| 200 | Successful read or update |
| 201 | Booking created |
| 204 | Booking deleted |
| 400 | Invalid or missing request data |
| 404 | Equipment or booking does not exist |
| 409 | Booking interval overlaps an existing booking |

All errors have this shape:

```json
{ "error": "Understandable error message" }
```

## Curl evidence

Start the server with `npm run dev`, then run these commands.

### 1. Successful read

```bash
curl -i http://localhost:8787/api/equipment
# HTTP/1.1 200 OK
# body contains eq-1 and eq-2
```

### 2. Successful create

```bash
curl -i -X POST http://localhost:8787/api/bookings \
  -H 'Content-Type: application/json' \
  -d '{"equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"2026-10-20T09:00:00.000Z","endAt":"2026-10-20T11:00:00.000Z","purpose":"Class presentation"}'
# HTTP/1.1 201 Created
# body contains id, equipmentId, borrowerName, startAt, endAt, purpose
```

### 3. Successful update

```bash
curl -i -X PATCH http://localhost:8787/api/bookings/<created-id> \
  -H 'Content-Type: application/json' \
  -d '{"purpose":"Updated class presentation"}'
# HTTP/1.1 200 OK
```

### 4. Overlapping booking

```bash
curl -i -X POST http://localhost:8787/api/bookings \
  -H 'Content-Type: application/json' \
  -d '{"equipmentId":"eq-1","borrowerName":"Another Borrower","startAt":"2026-10-20T10:00:00.000Z","endAt":"2026-10-20T12:00:00.000Z","purpose":"Conflict test"}'
# HTTP/1.1 409 Conflict
# {"error":"Booking conflicts with an existing booking"}
```

### 5. Invalid data

```bash
curl -i -X POST http://localhost:8787/api/bookings \
  -H 'Content-Type: application/json' \
  -d '{"equipmentId":"eq-1","borrowerName":"Invalid","startAt":"2026-10-20T11:00:00.000Z","endAt":"2026-10-20T09:00:00.000Z","purpose":"Invalid interval"}'
# HTTP/1.1 400 Bad Request
# {"error":"startAt must be before endAt"}
```

### 6. Resource not found

```bash
curl -i http://localhost:8787/api/bookings/missing-id
# HTTP/1.1 404 Not Found
# {"error":"Booking not found"}
```

### 7. Successful delete

```bash
curl -i -X DELETE http://localhost:8787/api/bookings/<created-id>
# HTTP/1.1 204 No Content
```

Automated equivalents are in `tests/app.test.ts`; they run with `npm test`.

## Observed live run

Against `http://localhost:8787/api`, the live curl run returned:

```text
equipment:200
bookings:200
create:201
get-booking:200
conflict:409
update:200
invalid:400
missing:404
delete:204
```

## Deployed API Verification

Deployed URL: `https://campus-equipment-booking-api.neon-dev.workers.dev/api`

Worker version: `eb4d84bd-5930-4715-a56d-ffa982cc8634`

The deployed Cloudflare Workers + D1 API passed these checks:

| Test case | Result |
| --- | --- |
| `GET /api/equipment` | `200` |
| `GET /api/bookings` | `200` |
| `POST /api/bookings` | `201` |
| `GET /api/bookings/:id` | `200` |
| `PATCH /api/bookings/:id` | `200` |
| Invalid time range | `400` |
| Overlapping POST | `409` |
| Overlapping PATCH | `409` |
| Missing booking | `404` |
| `DELETE /api/bookings/:id` | `204` |

Temporary verification bookings were deleted successfully after testing.
