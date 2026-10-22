import { publicApiFetch } from "./client.js";

export function getPublicTests(options = {}) {
  return publicApiFetch("/api/tests", options);
}
