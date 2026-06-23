const KNOWN_LOCALES = ["en", "zh-CN", "zh-TW", "ja", "ko"] as const;

function hasLocalePrefix(pathname: string): boolean {
  const first = pathname.split("/").filter(Boolean)[0];
  return (KNOWN_LOCALES as readonly string[]).includes(first ?? "");
}

/** Insert locale prefix into a share URL like /r/12345. */
export function localizeShareUrl(url: string, locale: string): string {
  try {
    const parsed = new URL(url);
    if (hasLocalePrefix(parsed.pathname)) {
      return parsed.toString();
    }
    parsed.pathname = parsed.pathname.replace(/^\/r\//, `/${locale}/r/`);
    return parsed.toString();
  } catch {
    if (hasLocalePrefix(url)) return url;
    return url.replace(/^(https?:\/\/[^/]+)\/r\//, `$1/${locale}/r/`).replace(/^\/r\//, `/${locale}/r/`);
  }
}
