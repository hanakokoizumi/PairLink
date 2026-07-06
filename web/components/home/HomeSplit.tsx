"use client";

import { AuthPanel } from "@/components/home/AuthPanel";
import { JoinPanel } from "@/components/home/JoinPanel";

export function HomeSplit() {
  return (
    <div className="mx-auto grid min-h-[calc(100dvh-3rem)] w-full max-w-5xl grid-cols-1 md:grid-cols-2">
      <AuthPanel />
      <JoinPanel />
    </div>
  );
}
