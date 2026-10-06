# Quality Gate Review

## Checkpoint

The first working API version was created before the Quality Gate improvements and review. It is represented by commit `3373ec6369a30c13c0205887bbacaf7cb85e4097` with message `checkpoint: first working API version`. No additional code changes were made at that checkpoint.

## Findings and fixes

### 1. Reliability / Accuracy

**What I found**

The overlap rule must reject partial overlaps, fully-contained bookings, and bookings that contain an existing booking. A simple equality check would miss several of these cases.

**How I fixed it**

Used the complete interval predicate in one parameterized query: `new_start < existing_end AND new_end > existing_start`.

**Evidence / verification**

The automated POST conflict test uses a booking beginning inside an existing interval and returns `409`. Boundary-touching intervals remain allowed by the strict comparisons.

### 2. Reliability / Data integrity

**What I found**

PATCH could accidentally validate only the fields supplied by the client and allow an invalid final interval or an unknown replacement equipment ID.

**How I fixed it**

PATCH loads the existing booking, merges supplied fields, normalizes the complete result, then validates equipment existence, ordering, and conflicts before updating.

**Evidence / verification**

The PATCH conflict test moves a booking to another equipment's occupied interval and receives `409`; the CRUD test confirms a partial purpose update returns the complete updated booking.

### 3. Reasoning / You Own It

**What I found**

A conflict query used during update must not match the booking being updated, or every unchanged booking would conflict with itself.

**How I fixed it**

The update query adds `id <> ?` and binds the current booking ID.

**Evidence / verification**

The CRUD test successfully PATCHes an existing booking without changing its interval. The implementation and rationale are recorded in `AI_LOG.md`.

### 4. API consistency

**What I found**

Clients need predictable machine-readable errors for malformed JSON and missing resources.

**How I fixed it**

All known validation, not-found, conflict, and unexpected server errors return JSON with an `error` property.

**Evidence / verification**

Automated tests cover `400`, `404`, and `409`; the curl evidence lists representative response bodies.

## Remaining risk

The project uses `better-sqlite3`, which requires a compatible native build for the local machine. Production deployment to Cloudflare D1 would require replacing the Node SQLite adapter with D1 binding calls while preserving the same SQL predicates and API contract.
