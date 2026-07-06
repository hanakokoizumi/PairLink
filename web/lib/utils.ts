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

/** Copy text to clipboard; falls back when Clipboard API is unavailable. */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // try legacy fallback below
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
