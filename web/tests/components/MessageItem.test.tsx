import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageItem } from "@/components/session/MessageItem";

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

function MaskedMessageFixture() {
  const [revealed, setRevealed] = useState(false);
  return (
    <MessageItem
      item={{
        kind: "message",
        id: "m1",
        direction: "recv",
        text: "**secret**",
        at: Date.now(),
        masked: true,
        revealed,
      }}
      onReveal={() => setRevealed(true)}
      onHide={() => setRevealed(false)}
    />
  );
}

describe("MessageItem", () => {
  it("masks content until revealed", async () => {
    const user = userEvent.setup();
    render(<MaskedMessageFixture />);
    expect(screen.getByText("••••••")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "session.showContent" }));
    expect(screen.getByText("secret")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "session.hideContent" }));
    expect(screen.getByText("••••••")).toBeInTheDocument();
  });

  it("renders markdown when not masked", () => {
    render(
      <MessageItem
        item={{
          kind: "message",
          id: "m2",
          direction: "send",
          text: "hello **world**",
          at: Date.now(),
          masked: false,
          revealed: true,
        }}
      />,
    );
    expect(screen.getByText("world")).toBeInTheDocument();
  });
});
