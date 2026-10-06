import { D1BookingDatabase } from './d1.js';
import { createApp } from './app.js';

export default {
  fetch(request: Request, env: Env, context: ExecutionContext): Response | Promise<Response> {
    return createApp(new D1BookingDatabase(env.DB)).fetch(request, env, context);
  },
};