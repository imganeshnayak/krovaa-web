export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";
export const SOCKET_URL = API_BASE_URL || undefined;
export const API_URL = API_BASE_URL;

if (typeof globalThis !== "undefined") {
  (globalThis as typeof globalThis & { API_URL?: string }).API_URL = API_BASE_URL;
}

export function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  let baseUrl = API_BASE_URL;
  let subPath = path.startsWith("/") ? path : `/${path}`;
  
  // Safe deduplication: If API_BASE_URL ends with '/api' and the path starts with '/api/'
  if (baseUrl.endsWith("/api") && subPath.startsWith("/api/")) {
    subPath = subPath.substring(4); // Remove the '/api' prefix from the subpath
  }
  
  return `${baseUrl}${subPath}`;
}

export function remoteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  let baseUrl = API_BASE_URL;
  let subPath = path.startsWith("/") ? path : `/${path}`;
  
  if (baseUrl.endsWith("/api") && subPath.startsWith("/api/")) {
    subPath = subPath.substring(4);
  }
  
  return `${baseUrl}${subPath}`;
}
