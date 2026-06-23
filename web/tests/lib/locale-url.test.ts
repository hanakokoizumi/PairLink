import { describe, expect, it } from "vitest";
import { localizeShareUrl } from "@/lib/locale-url";

describe("localizeShareUrl", () => {
  it("inserts locale before /r/ path", () => {
    expect(localizeShareUrl("http://localhost:8080/r/12345", "zh-CN")).toBe(
      "http://localhost:8080/zh-CN/r/12345",
    );
  });

  it("leaves already-localized URLs unchanged", () => {
    const url = "http://localhost:8080/en/r/12345";
    expect(localizeShareUrl(url, "zh-CN")).toBe(url);
  });
});
