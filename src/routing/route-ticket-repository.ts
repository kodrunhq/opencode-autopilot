import type { Database } from "bun:sqlite";
import { randomBytes } from "node:crypto";

export const ROUTE_TICKET_PREFIX = "rtk_";

export interface RouteTicket {
	routeToken: string;
	projectId: string;
	sessionId: string;
	messageId: string;
	intent: string;
	usePipeline: boolean;
	issuedAt: string;
	expiresAt: string;
	consumedAt: string | null;
	metadataJson: string;
}

export interface RouteTicketCreate {
	projectId: string;
	sessionId: string;
	messageId: string;
	intent: string;
	usePipeline: boolean;
	metadata?: Record<string, unknown>;
	ttlMinutes?: number;
}

function generateRouteToken(): string {
	return `${ROUTE_TICKET_PREFIX}${randomBytes(16).toString("hex")}`;
}

function getDefaultExpiration(ttlMinutes = 10): string {
	const expiresAt = new Date();
	expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);
	return expiresAt.toISOString();
}

export function createRouteTicketRepository(db: Database) {
	const selectRawTicket = `
		SELECT
			route_token as routeToken,
			project_id as projectId,
			session_id as sessionId,
			message_id as messageId,
			intent,
			use_pipeline as usePipeline,
			issued_at as issuedAt,
			expires_at as expiresAt,
			consumed_at as consumedAt,
			metadata_json as metadataJson
		FROM route_tickets
		WHERE route_token = ?
	`;

	type RawRouteTicket = {
		readonly routeToken: string;
		readonly projectId: string;
		readonly sessionId: string;
		readonly messageId: string;
		readonly intent: string;
		readonly usePipeline: number;
		readonly issuedAt: string;
		readonly expiresAt: string;
		readonly consumedAt: string | null;
		readonly metadataJson: string;
	};

	function parseTicket(row: RawRouteTicket): RouteTicket {
		return {
			routeToken: row.routeToken,
			projectId: row.projectId,
			sessionId: row.sessionId,
			messageId: row.messageId,
			intent: row.intent,
			usePipeline: row.usePipeline === 1,
			issuedAt: row.issuedAt,
			expiresAt: row.expiresAt,
			consumedAt: row.consumedAt,
			metadataJson: row.metadataJson,
		};
	}

	function getTicketByToken(routeToken: string): RouteTicket | null {
		const row = db.query(selectRawTicket).get(routeToken) as RawRouteTicket | null;
		return row ? parseTicket(row) : null;
	}

	return {
		createTicket(params: RouteTicketCreate): RouteTicket {
			const routeToken = generateRouteToken();
			const issuedAt = new Date().toISOString();
			const expiresAt = getDefaultExpiration(params.ttlMinutes);
			const metadataJson = JSON.stringify(params.metadata ?? {});

			const stmt = db.prepare(`
				INSERT INTO route_tickets (
					route_token, project_id, session_id, message_id, intent,
					use_pipeline, issued_at, expires_at, consumed_at, metadata_json
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
			`);

			stmt.run(
				routeToken,
				params.projectId,
				params.sessionId,
				params.messageId,
				params.intent,
				params.usePipeline ? 1 : 0,
				issuedAt,
				expiresAt,
				metadataJson,
			);

			return {
				routeToken,
				projectId: params.projectId,
				sessionId: params.sessionId,
				messageId: params.messageId,
				intent: params.intent,
				usePipeline: params.usePipeline,
				issuedAt,
				expiresAt,
				consumedAt: null,
				metadataJson,
			};
		},

		getValidTicket(routeToken: string): RouteTicket | null {
			const now = new Date().toISOString();
			const ticket = getTicketByToken(routeToken);
			if (!ticket || ticket.consumedAt !== null || ticket.expiresAt <= now) {
				return null;
			}
			return ticket;
		},

		consumeTicket(routeToken: string): boolean {
			const now = new Date().toISOString();
			const result = db.run(
				"UPDATE route_tickets SET consumed_at = ? WHERE route_token = ? AND consumed_at IS NULL",
				[now, routeToken],
			);
			return result.changes > 0;
		},

		validateAndConsumeTicket(
			routeToken: string,
			params: {
				sessionId: string;
				messageId: string;
				projectId: string;
				intent: string;
			},
		): { valid: boolean; reason?: string } {
			const ticket = getTicketByToken(routeToken);

			if (!ticket) {
				return { valid: false, reason: "Route ticket not found, expired, or already consumed" };
			}
			if (ticket.consumedAt !== null) {
				return { valid: false, reason: "Route ticket already consumed" };
			}
			if (ticket.expiresAt <= new Date().toISOString()) {
				return { valid: false, reason: "Route ticket expired" };
			}

			if (ticket.sessionId !== params.sessionId) {
				return { valid: false, reason: "Route ticket session mismatch" };
			}

			if (ticket.messageId !== params.messageId) {
				return { valid: false, reason: "Route ticket message mismatch" };
			}

			if (ticket.projectId !== params.projectId) {
				return { valid: false, reason: "Route ticket project mismatch" };
			}

			if (ticket.intent !== params.intent) {
				return { valid: false, reason: "Route ticket intent mismatch" };
			}

			if (!ticket.usePipeline) {
				return { valid: false, reason: "Route ticket not authorized for pipeline use" };
			}

			const consumed = this.consumeTicket(routeToken);
			if (!consumed) {
				return { valid: false, reason: "Route ticket already consumed" };
			}

			return { valid: true };
		},

		cleanupExpiredTickets(): number {
			const now = new Date().toISOString();
			const result = db.run("DELETE FROM route_tickets WHERE expires_at < ?", [now]);
			return result.changes;
		},
	};
}

export type RouteTicketRepository = ReturnType<typeof createRouteTicketRepository>;
