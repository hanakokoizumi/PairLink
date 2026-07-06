import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinPanel } from "@/components/home/JoinPanel";
import { useConfigStore } from "@/lib/stores/config-store";

vi.mock("@/lib/api", () => ({
  lookupRoom: vi.fn(),
  mapErrorCode: (code: string) => `errors.${code}`,
}));

describe("JoinPanel", () => {
  beforeEach(() => {
    useConfigStore.setState({
      config: {
        publicUrl: "http://localhost:8080",
        disableAuth: true,
        oidcEnabled: false,
        wsFallback: true,
        rtcConfig: { iceServers: [] },
        settings: {
          autoAcceptFiles: true,
          defaultMaskOnSend: false,
          defaultTheme: "dark",
          defaultLocale: "en",
          supportedLocales: ["en"],
          roomCodeLength: 5,
          iceTimeoutSec: 15,
          fileMaxSizeBytes: 1000,
          messageMaxLength: 1000,
          resumeTransferEnabled: true,
        },
      },
      loaded: true,
      loading: false,
      error: null,
    });
  });

  it("renders OTP inputs for room code", () => {
    render(<JoinPanel />);
    expect(screen.getAllByText("home.joinConnection").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("textbox")).toHaveLength(5);
  });

  it("disables join until code is complete", async () => {
    const user = userEvent.setup();
    render(<JoinPanel />);
    const button = screen.getByRole("button", { name: "home.joinConnection" });
    expect(button).toBeDisabled();
    const inputs = screen.getAllByRole("textbox");
    for (let i = 0; i < 5; i++) {
      await user.type(inputs[i]!, String(i + 1));
    }
    expect(button).not.toBeDisabled();
  });

  it("fills all cells when pasting a code", async () => {
    const user = userEvent.setup();
    render(<JoinPanel />);
    const inputs = screen.getAllByRole("textbox");
    await user.click(inputs[0]!);
    await user.paste("abcde");
    const button = screen.getByRole("button", { name: "home.joinConnection" });
    expect(button).not.toBeDisabled();
    expect(inputs.map((input) => (input as HTMLInputElement).value)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
  });
});
