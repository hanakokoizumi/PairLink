import type { FileMetaPayload } from "@/lib/webrtc/file-transfer";

export type ResumeQuery = { id: string };
export type ResumeState = { id: string; receivedBytes: number };
export type ResumeCancel = { id: string };

export function createResumeQuery(id: string): ResumeQuery {
  return { id };
}

export function createResumeState(id: string, receivedBytes: number): ResumeState {
  return { id, receivedBytes };
}

export function shouldResume(meta: FileMetaPayload, enabled: boolean): boolean {
  return Boolean(enabled && meta.resume);
}

export function resumeOffset(
  storedBytes: number,
  fileSize: number,
): number {
  return Math.min(Math.max(0, storedBytes), fileSize);
}

export function isResumeComplete(receivedBytes: number, fileSize: number): boolean {
  return receivedBytes >= fileSize;
}
