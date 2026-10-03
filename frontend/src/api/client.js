export const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL ||
  (import.meta.env?.DEV
    ? "http://localhost:8080"
    : "https://toeicpracticeweb.onrender.com");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
let csrfTokenPromise = null;

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  const text = await response.text();
  return text || null;
}

function errorFromResponse(response, body) {
  const message =
    body?.detail ||
    body?.message ||
    body?.error ||
    (typeof body === "string" ? body : `Request failed (${response.status})`);
  return new ApiError(message, response.status, body);
}

export function clearCsrfToken() {
  csrfTokenPromise = null;
}

export async function getCsrfToken() {
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch(`${API_BASE_URL}/api/v1/auth/csrf`, {
      credentials: "include",
    })
      .then(async (response) => {
        const body = await parseResponse(response);
        if (!response.ok) {
          throw errorFromResponse(response, body);
        }
        if (!body?.token) {
          throw new ApiError("CSRF token response is invalid.", 500, body);
        }
        return body.token;
      })
      .catch((error) => {
        csrfTokenPromise = null;
        throw error;
      });
  }
  return csrfTokenPromise;
}

async function request(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (options.body != null && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!SAFE_METHODS.has(method)) {
    headers.set("X-XSRF-TOKEN", await getCsrfToken());
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
  });
  const body = await parseResponse(response);
  if (!response.ok) {
    throw errorFromResponse(response, body);
  }
  return body;
}

export function apiFetch(path, options = {}) {
  return request(path, options);
}

export function publicApiFetch(path, options = {}) {
  return request(path, options);
}
