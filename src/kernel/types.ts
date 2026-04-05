import type { ForensicEvent } from "../observability/forensic-types";
import type { PipelineState } from "../orchestrator/types";
import type { ReviewState } from "../review/types";

export const KERNEL_STATE_CONFLICT_CODE = "E_STATE_CONFLICT";

export interface PipelineRunRow {
	readonly project_id: string;
	readonly run_id: string;
	readonly schema_version: number;
	readonly status: PipelineState["status"];
	readonly current_phase: string | null;
	readonly idea: string;
	readonly state_revision: number;
	readonly started_at: string;
	readonly last_updated_at: string;
	readonly failure_phase: string | null;
	readonly failure_agent: string | null;
	readonly failure_message: string | null;
	readonly last_successful_phase: string | null;
	readonly state_json: string;
}

export interface ActiveReviewStateRow {
	readonly project_id: string;
	readonly stage: ReviewState["stage"];
	readonly scope: string;
	readonly started_at: string;
	readonly saved_at: string;
	readonly state_json: string;
}

export interface ProjectReviewMemoryRow {
	readonly project_id: string;
	readonly schema_version: number;
	readonly last_reviewed_at: string | null;
	readonly state_json: string;
}

export interface ProjectLessonMemoryRow {
	readonly project_id: string;
	readonly schema_version: number;
	readonly last_updated_at: string | null;
	readonly state_json: string;
}

export interface ForensicEventRow {
	readonly event_id: number;
	readonly project_id: string;
	readonly schema_version: number;
	readonly timestamp: string;
	readonly project_root: string;
	readonly domain: ForensicEvent["domain"];
	readonly run_id: string | null;
	readonly session_id: string | null;
	readonly parent_session_id: string | null;
	readonly phase: string | null;
	readonly dispatch_id: string | null;
	readonly task_id: number | null;
	readonly agent: string | null;
	readonly type: ForensicEvent["type"];
	readonly code: string | null;
	readonly message: string | null;
	readonly payload_json: string;
}
