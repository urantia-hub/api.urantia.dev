import type { ExecutionContext } from "@cloudflare/workers-types";
import { Logtail } from "@logtail/edge";

export interface Logger {
	info(message: string, context?: Record<string, unknown>): void;
	warn(message: string, context?: Record<string, unknown>): void;
	error(message: string | Error, context?: Record<string, unknown>): void;
	debug(message: string, context?: Record<string, unknown>): void;
}

const token = process.env.BETTERSTACK_SOURCE_TOKEN;

const baseLogger = token ? new Logtail(token) : null;

/**
 * Returns a BetterStack logger bound to the current request's ExecutionContext,
 * or a console-based fallback for local development.
 */
export function getLogger(ctx?: ExecutionContext): Logger {
	if (baseLogger && ctx) {
		return baseLogger.withExecutionContext(ctx);
	}

	// Dev fallback: structured console output
	return {
		info(message, context) {
			console.log(JSON.stringify({ level: "info", message, ...context }));
		},
		warn(message, context) {
			console.warn(JSON.stringify({ level: "warn", message, ...context }));
		},
		error(message, context) {
			const msg = message instanceof Error ? message.message : message;
			console.error(JSON.stringify({ level: "error", message: msg, ...context }));
		},
		debug(message, context) {
			console.debug(JSON.stringify({ level: "debug", message, ...context }));
		},
	};
}
