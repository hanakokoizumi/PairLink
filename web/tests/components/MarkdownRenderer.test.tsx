import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { MarkdownRenderer } from "@/components/session/MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders markdown content", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="dark">
        <MarkdownRenderer content="**bold** text" />
      </ThemeProvider>,
    );
    expect(screen.getByText("bold")).toBeInTheDocument();
    expect(screen.getByText("text")).toBeInTheDocument();
  });

  it("does not render raw html tags", () => {
    const { container } = render(
      <ThemeProvider attribute="class" defaultTheme="dark">
        <MarkdownRenderer content="Hello <img src=x onerror=alert(1)> **world**" />
      </ThemeProvider>,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("world")).toBeInTheDocument();
  });
});
