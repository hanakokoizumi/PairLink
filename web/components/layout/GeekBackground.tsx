"use client";

export function GeekBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-background" />
      <div className="absolute -left-1/4 top-0 h-[480px] w-[480px] rounded-full bg-primary/[0.05] blur-[100px]" />
      <div className="absolute -right-1/4 bottom-0 h-[400px] w-[400px] rounded-full bg-accent/[0.05] blur-[80px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_75%)]" />
    </div>
  );
}
