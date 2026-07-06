import { describe, expect, it, vi } from "vitest";
import { DataChannelClient } from "@/lib/webrtc/datachannel";
import { BUFFER_LOW_THRESHOLD, CHUNK_SIZE } from "@/lib/webrtc/file-transfer";

function createMockChannel() {
  let bufferedAmount = 0;
  const listeners = new Map<string, Set<() => void>>();
  const channel = {
    readyState: "open" as RTCDataChannelState,
    binaryType: "arraybuffer" as BinaryType,
    bufferedAmountLowThreshold: 0,
    get bufferedAmount() {
      return bufferedAmount;
    },
    set bufferedAmount(value: number) {
      bufferedAmount = value;
    },
    send: vi.fn((data: ArrayBuffer) => {
      bufferedAmount += data.byteLength;
    }),
    addEventListener: vi.fn((type: string, handler: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(handler);
    }),
    removeEventListener: vi.fn((type: string, handler: () => void) => {
      listeners.get(type)?.delete(handler);
    }),
    drainBuffer() {
      bufferedAmount = 0;
      listeners.get("bufferedamountlow")?.forEach((handler) => handler());
    },
  };
  return channel as unknown as RTCDataChannel & {
    drainBuffer: () => void;
    bufferedAmount: number;
  };
}

describe("DataChannelClient", () => {
  it("sets bufferedAmountLowThreshold from BUFFER_LOW_THRESHOLD", () => {
    const channel = createMockChannel();
    new DataChannelClient(channel);
    expect(channel.bufferedAmountLowThreshold).toBe(BUFFER_LOW_THRESHOLD);
  });

  it("waits for bufferedamountlow before sending when buffer is full", async () => {
    const channel = createMockChannel();
    const client = new DataChannelClient(channel);
    const chunk = new Uint8Array(CHUNK_SIZE).buffer;
    channel.bufferedAmount = BUFFER_LOW_THRESHOLD;

    const sendPromise = client.sendBinary(
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      0,
      chunk,
    );

    let settled = false;
    void sendPromise.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(channel.send).not.toHaveBeenCalled();

    channel.drainBuffer();
    await sendPromise;
    expect(channel.send).toHaveBeenCalledTimes(1);
  });

  it("sends immediately when buffer has capacity", async () => {
    const channel = createMockChannel();
    const client = new DataChannelClient(channel);
    const chunk = new Uint8Array(128).buffer;

    await client.sendBinary(
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      0,
      chunk,
    );

    expect(channel.send).toHaveBeenCalledTimes(1);
  });
});
