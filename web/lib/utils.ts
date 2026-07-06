import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Safe filename for programmatic downloads (strips path separators and control chars). */
export function sanitizeDownloadFilename(name: string): string {
  const base = name
    .replace(/[/\\<>:"|?*\x00-\x1f]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  return base.slice(0, 255) || "download";
}
