import { cors } from "hono/cors";

export const corsMiddleware = cors({
	origin: "*",
	allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
	allowHeaders: ["Content-Type", "Authorization"],
});
