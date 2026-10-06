import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createDatabase } from './db.js';

const database = createDatabase(process.env.DATABASE_FILE ?? './data.db');
const port = Number(process.env.PORT ?? 8787);

serve({ fetch: createApp(database).fetch, port }, (info) => {
  console.log(`Campus Equipment Booking API listening on http://localhost:${info.port}`);
});
