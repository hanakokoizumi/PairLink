/** Uppercase and map O/I to 0/1 for room code input and lookup. */
export function normalizeRoomCode(code: string): string {
  return code
    .replace(/[Oo]/g, "0")
    .replace(/[Ii]/g, "1")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

export function normalizeRoomCodeChar(value: string): string {
  return normalizeRoomCode(value).slice(-1);
}
