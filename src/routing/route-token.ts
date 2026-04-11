import { randomBytes } from "node:crypto";
import type { IntentType } from "./intent-types";

const ROUTE_TOKEN_TTL_MS = 5 * 60 * 1000;

interface RouteTokenRecord {
	readonly token: string;
	readonly sessionID: string;
	readonly projectRoot: string;
	readonly messageID: string | null;
	readonly intent: IntentType;
	readonly issuedAt: number;
	readonly expiresAt: number;
	consumed: boolean;
}

interface RouteTokenIssue {
	readonly token: string;
	readonly expiresAt: string;
}

interface RouteTokenValidationResult {
	readonly ok: boolean;
	readonly code?: string;
	readonly message?: string;
}

const activeTokens = new Map<string, RouteTokenRecord>();

function now(): number {
	return Date.now();
}

function resolveMessageID(messageID: string | undefined): string | null {
	if (!messageID) {
		return null;
	}
	const trimmed = messageID.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function pruneExpiredTokens(nowMs: number): void {
	for (const [token, record] of activeTokens) {
		if (record.expiresAt <= nowMs) {
			activeTokens.delete(token);
		}
	}
}

export function issueRouteToken(args: {
	readonly sessionID: string;
	readonly projectRoot: string;
	readonly messageID?: string;
	readonly intent: IntentType;
}): RouteTokenIssue {
	pruneExpiredTokens(now());
	const token = `rt_${randomBytes(8).toString("hex")}`;
	const issuedAt = now();
	const expiresAt = issuedAt + ROUTE_TOKEN_TTL_MS;
	activeTokens.set(token, {
		token,
		sessionID: args.sessionID,
		projectRoot: args.projectRoot,
		messageID: resolveMessageID(args.messageID),
		intent: args.intent,
		issuedAt,
		expiresAt,
		consumed: false,
	});
	return Object.freeze({ token, expiresAt: new Date(expiresAt).toISOString() });
}

export function consumeRouteToken(args: {
	readonly sessionID: string;
	readonly projectRoot: string;
	readonly messageID?: string;
	readonly intent: IntentType;
	readonly routeToken?: string;
}): RouteTokenValidationResult {
	const token = args.routeToken;
	pruneExpiredTokens(now());

	if (!token) {
		return {
			ok: false,
			code: "E_ROUTE_TOKEN_REQUIRED",
			message:
				"Route token is required for implementation pipeline starts. Call oc_route first and pass routeToken.",
		};
	}

	const record = activeTokens.get(token);
	if (!record) {
		return {
			ok: false,
			code: "E_ROUTE_TOKEN_INVALID",
			message: "Route token is invalid or was never issued.",
		};
	}
	if (record.consumed) {
		return {
			ok: false,
			code: "E_ROUTE_TOKEN_CONSUMED",
			message: "Route token was already used. Call oc_route again for a new token.",
		};
	}
	if (record.sessionID !== args.sessionID) {
		return {
			ok: false,
			code: "E_ROUTE_TOKEN_MISMATCH",
			message: "Route token was issued for a different session.",
		};
	}
	if (record.projectRoot !== args.projectRoot) {
		return {
			ok: false,
			code: "E_ROUTE_TOKEN_MISMATCH",
			message: "Route token was issued for a different project root.",
		};
	}
	if (record.intent !== args.intent) {
		return {
			ok: false,
			code: "E_ROUTE_TOKEN_INVALID",
			message: `Route token is not valid for intent '${args.intent}'.`,
		};
	}

	const messageID = resolveMessageID(args.messageID);
	if (record.messageID !== null && record.messageID !== messageID) {
		return {
			ok: false,
			code: "E_ROUTE_TOKEN_MISMATCH",
			message: "Route token was issued for a different user message.",
		};
	}

	record.consumed = true;
	return { ok: true };
}
