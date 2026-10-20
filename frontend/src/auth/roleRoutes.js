
export const USER_HOME = "/dashboard";
export const CONSOLE_HOME = "/console/dashboard";

export function resolveHomePath(role) {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "ADMIN" || normalized === "EMPLOYEE") return CONSOLE_HOME;
  return USER_HOME;
}
