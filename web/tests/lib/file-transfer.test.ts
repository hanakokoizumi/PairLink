import { describe, expect, it } from "vitest";
import {
  CHUNK_SIZE,
  ACK_EVERY,
  buildChunkFrame,
  chunkIndexFromOffset,
  computeProgress,
  inFlightWindowBytes,
  nextChunkOffset,
  parseChunkFrame,
  shouldAck,
  shouldSendAck,
  validateFileSize,
} from "@/lib/webrtc/file-transfer";

describe("file-transfer", () => {
  it("validates file size against limit", () => {
    expect(validateFileSize(100, 1000)).toBe(true);
    expect(validateFileSize(1001, 1000)).toBe(false);
  });

  it("computes progress percentage", () => {
    expect(computeProgress(50, 100)).toBe(50);
    expect(computeProgress(100, 100)).toBe(100);
    expect(computeProgress(0, 0)).toBe(0);
  });

  it("calculates next chunk offset", () => {
    expect(nextChunkOffset(0, CHUNK_SIZE * 2)).toBe(CHUNK_SIZE);
    expect(nextChunkOffset(CHUNK_SIZE * 2 - 10, CHUNK_SIZE * 2)).toBe(
      CHUNK_SIZE * 2,
    );
  });

  it("determines ack intervals", () => {
    expect(shouldAck(ACK_EVERY)).toBe(true);
    expect(shouldAck(ACK_EVERY + 1)).toBe(false);
  });

  it("computes chunk index from received bytes", () => {
    expect(chunkIndexFromOffset(0)).toBe(0);
    expect(chunkIndexFromOffset(CHUNK_SIZE)).toBe(1);
    expect(chunkIndexFromOffset(CHUNK_SIZE * ACK_EVERY)).toBe(ACK_EVERY);
  });

  it("computes in-flight window bytes", () => {
    expect(inFlightWindowBytes()).toBe(ACK_EVERY * CHUNK_SIZE * 2);
  });

  it("sends ack on periodic chunks and final chunk", () => {
    const fileSize = CHUNK_SIZE * ACK_EVERY + 100;
    expect(shouldSendAck(CHUNK_SIZE * ACK_EVERY, fileSize)).toBe(true);
    expect(shouldSendAck(CHUNK_SIZE, fileSize)).toBe(false);
    expect(shouldSendAck(fileSize, fileSize)).toBe(true);
  });

  it("round-trips binary chunk frames", () => {
    const transferId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const payload = new Uint8Array([1, 2, 3, 4]).buffer;
    const frame = buildChunkFrame(transferId, 128, payload);
    const parsed = parseChunkFrame(frame);
    expect(parsed).not.toBeNull();
    expect(parsed!.offset).toBe(128);
    expect(new Uint8Array(parsed!.payload)).toEqual(new Uint8Array(payload));
  });
});
