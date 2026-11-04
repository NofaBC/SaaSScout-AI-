import { hashIdempotency, normalizeEmail } from "./ids";
import { MockMailer, type Mailer } from "./mailer";
import type { Store } from "./store/base";
import { ConflictError, NotFoundError } from "./store/base";
import type { SendRecord } from "./types";

export class UncertainSendError extends Error {
  readonly code = "SEND_RESULT_UNCERTAIN";
}

export async function sendApprovedDraft(
  store: Store,
  draftId: string,
  recipient: string,
  mailer: Mailer = new MockMailer(),
): Promise<SendRecord> {
  const draft = await store.getDraft(draftId);
  if (!draft) throw new NotFoundError("Draft not found.");

  const key = hashIdempotency([
    draft.workspaceId,
    draft.id,
    draft.version,
    normalizeEmail(recipient),
    draft.subject,
  ]);

  const existing = await store.findSendByIdempotencyKey(key);
  if (existing && existing.status !== "failed") {
    throw new ConflictError(
      existing.status === "uncertain"
        ? "A previous send result is uncertain. Check Gmail Sent before retrying."
        : "This draft version has already been sent to this recipient.",
    );
  }

  const normalizedRecipient = normalizeEmail(recipient);
  const recent = (await store.listSends()).find((send) => {
    const ageMs = Date.now() - new Date(send.createdAt).getTime();
    return (
      send.recipient === normalizedRecipient &&
      ageMs < 24 * 60 * 60 * 1000 &&
      (send.status === "sent" || send.status === "sending" || send.status === "uncertain")
    );
  });
  if (recent) {
    throw new ConflictError(
      recent.status === "uncertain"
        ? "A recent send to this recipient is uncertain. Check Gmail Sent before retrying."
        : "This recipient already has a recent send. The 24-hour cooldown is active.",
    );
  }

  if (draft.status !== "approved") {
    throw new ConflictError("The draft must be approved before sending.");
  }

  const attempt = await store.createSendAttempt({
    draft,
    recipient: normalizedRecipient,
    idempotencyKey: key,
    provider: mailer.provider,
  });

  try {
    const result = await mailer.send({
      from: "Connected sender",
      to: normalizedRecipient,
      subject: draft.subject,
      body: draft.body,
    });
    return store.completeSend(attempt.id, {
      providerMessageId: result.providerMessageId,
      acceptedAt: result.acceptedAt,
    });
  } catch (error) {
    if (error instanceof UncertainSendError) {
      return store.failSend(attempt.id, "uncertain", error.code);
    }
    return store.failSend(attempt.id, "failed", "SEND_FAILED");
  }
}
