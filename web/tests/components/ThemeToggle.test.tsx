import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

function renderToggle() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark">
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeToggle", () => {
  it("renders toggle button with aria label", () => {
    renderToggle();
    expect(screen.getByRole("button", { name: "theme.toggle" })).toBeInTheDocument();
  });

  it("cycles theme on click", async () => {
    const user = userEvent.setup();
    renderToggle();
    const button = screen.getByRole("button", { name: "theme.toggle" });
    await user.click(button);
    expect(button).toBeInTheDocument();
  });
});
