import { auth } from "../firebase";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://toeicpracticeweb.onrender.com";

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

async function request(path, options, forceRefresh) {
  const user = auth.currentUser;
  if (!user) {
    throw new ApiError("Please sign in to continue.", 401, null);
  }

  const idToken = await user.getIdToken(forceRefresh);
  const headers = new Headers(options.headers || {});
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Authorization", `Bearer ${idToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const body = await parseResponse(response);

  if (!response.ok) {
    const message =
      body?.detail ||
      body?.message ||
      body?.error ||
      (typeof body === "string" ? body : `Request failed (${response.status})`);
    throw new ApiError(message, response.status, body);
  }
  return body;
}

export async function apiFetch(
  path,
  { forceRefresh = false, ...options } = {},
) {
  try {
    return await request(path, options, forceRefresh);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && !forceRefresh) {
      return request(path, options, true);
    }
    throw error;
  }
}

export async function publicApiFetch(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const body = await parseResponse(response);
  if (!response.ok) {
    throw new ApiError(
      body?.detail || body?.message || `Unable to load data (${response.status})`,
      response.status,
      body,
    );
  }
  return body;
}
