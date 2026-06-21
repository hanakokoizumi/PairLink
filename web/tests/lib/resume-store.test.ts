import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  deleteResumeRecord,
  getResumeRecord,
  purgeExpiredRecords,
  resetResumeDbForTests,
  saveResumeRecord,
} from "@/lib/storage/resume-store";

describe("resume-store", () => {
  beforeEach(() => {
    resetResumeDbForTests();
  });

  it("saves and retrieves resume records", async () => {
    await saveResumeRecord({
      transferId: "test-id",
      roomId: "room-1",
      name: "file.bin",
      size: 1000,
      mime: "application/octet-stream",
      receivedBytes: 500,
      chunks: [new Uint8Array([1, 2, 3]).buffer],
      direction: "recv",
      updatedAt: Date.now(),
    });

    const record = await getResumeRecord("test-id");
    expect(record?.receivedBytes).toBe(500);
    expect(record?.name).toBe("file.bin");
  });

  it("deletes resume records", async () => {
    await saveResumeRecord({
      transferId: "del-id",
      roomId: "room-1",
      name: "a.txt",
      size: 10,
      mime: "text/plain",
      receivedBytes: 0,
      chunks: [],
      direction: "recv",
      updatedAt: Date.now(),
    });
    await deleteResumeRecord("del-id");
    expect(await getResumeRecord("del-id")).toBeUndefined();
  });

  it("purges expired records", async () => {
    await saveResumeRecord({
      transferId: "old-id",
      roomId: "room-1",
      name: "old.bin",
      size: 1,
      mime: "application/octet-stream",
      receivedBytes: 0,
      chunks: [],
      direction: "recv",
      updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
    });
    const removed = await purgeExpiredRecords();
    expect(removed).toBe(1);
    expect(await getResumeRecord("old-id")).toBeUndefined();
  });
});
