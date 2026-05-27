export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";
export const SOCKET_URL = API_BASE_URL || undefined;
export const API_URL = API_BASE_URL;

if (typeof globalThis !== "undefined") {
  (globalThis as typeof globalThis & { API_URL?: string }).API_URL = API_BASE_URL;
}

export function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith("/")) path = `/${path}`;
  return `${API_BASE_URL}${path}`;
}

export function remoteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}
