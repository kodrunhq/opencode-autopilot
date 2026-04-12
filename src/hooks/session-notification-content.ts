import { stripInternalReasoning } from "../ux/visibility";

interface SessionMessage {
	readonly role: string;
	readonly text: string;
}

export interface NotificationContentContext {
	readonly getSessionTitle: (sessionID: string) => Promise<string>;
	readonly getSessionMessages: (sessionID: string) => Promise<ReadonlyArray<SessionMessage>>;
}

export interface NotificationContentInput {
	readonly sessionID: string;
	readonly baseTitle: string;
	readonly baseMessage: string;
}

function collapseWhitespace(text: string): string {
	return text
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.join(" ")
		.replace(/\s+/gu, " ")
		.trim();
}

function getLastNonEmptyLine(text: string): string {
	const nonEmptyLines = text
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	return nonEmptyLines.at(-1) ?? "";
}

function findLastMessageByRole(
	messages: ReadonlyArray<SessionMessage>,
	role: string,
): SessionMessage | undefined {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role !== role) continue;
		if (message.text.trim().length === 0) continue;
		return message;
	}

	return undefined;
}

export function createNotificationContentBuilder(ctx: NotificationContentContext) {
	return async function buildContent(
		input: NotificationContentInput,
	): Promise<{ title: string; message: string }> {
		try {
			const [sessionTitle, messages] = await Promise.all([
				ctx.getSessionTitle(input.sessionID),
				ctx.getSessionMessages(input.sessionID),
			]);

			const lastUserMessage = findLastMessageByRole(messages, "user");
			const lastAssistantMessage = findLastMessageByRole(messages, "assistant");

			const userSummary = lastUserMessage ? collapseWhitespace(lastUserMessage.text) : "";
			const assistantSummary = lastAssistantMessage
				? getLastNonEmptyLine(stripInternalReasoning(lastAssistantMessage.text))
				: "";

			const detailLines = [
				userSummary ? `User: ${userSummary}` : "",
				assistantSummary ? `Assistant: ${assistantSummary}` : "",
			].filter((line) => line.length > 0);

			const titleSuffix = sessionTitle.trim();
			const title = titleSuffix ? `${input.baseTitle} · ${titleSuffix}` : input.baseTitle;
			const message =
				detailLines.length > 0
					? `${input.baseMessage}\n${detailLines.join("\n")}`
					: input.baseMessage;

			return { title, message };
		} catch {
			return {
				title: input.baseTitle,
				message: input.baseMessage,
			};
		}
	};
}
