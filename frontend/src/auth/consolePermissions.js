const creatorPermissions = ["dashboard.view", "tests.view", "tests.add", "tests.edit", "tests.delete"];

export function canUseConsole(profile, permission) {
  if (permission.startsWith("subscriptions.")) return false;
  if (!profile || !["ADMIN", "EMPLOYEE"].includes(profile.role)) return false;
  if (profile.passwordChangeRequired) return false;
  const access = profile.consoleAccess;
  if (access && !access.active) return false;
  if (permission === "account.view") return true;
  if (permission.startsWith("staff.")) return profile.role === "ADMIN";
  if (profile.role === "ADMIN") return true;
  return (access?.permissions || creatorPermissions).includes(permission);
}

export function consoleRoutePermission(pathname) {
  if (pathname === "/console/profile") return "account.view";
  if (pathname === "/console/tests/new") return "tests.add";
  if (/^\/console\/tests\/[^/]+\/edit$/.test(pathname)) return "tests.edit";
  if (pathname.startsWith("/console/tests")) return "tests.view";
  if (pathname.startsWith("/console/staff")) return "staff.view";
  if (pathname.startsWith("/console/review-history")) return "history.view";
  if (pathname.startsWith("/console/reviews")) return "reviews.view";
  if (pathname.startsWith("/console/revenue")) return "revenue.view";
  if (pathname.startsWith("/console/orders")) return "orders.view";
  return "dashboard.view";
}

export function togglePermission(permissions, feature, action, checked) {
  const next = new Set(permissions);
  const removeFeature = () => feature.actions.forEach((item) => next.delete(`${feature.id}.${item}`));
  if (action === "blocked") {
    if (checked) removeFeature();
    else next.add(`${feature.id}.view`);
  } else if (action === "all") {
    if (checked) feature.actions.forEach((item) => next.add(`${feature.id}.${item}`));
    else removeFeature();
  } else if (checked) {
    next.add(`${feature.id}.${action}`);
    next.add(`${feature.id}.view`);
  } else if (action === "view") removeFeature();
  else next.delete(`${feature.id}.${action}`);
  return [...next];
}

export function consoleHome(profile) {
  if (profile?.passwordChangeRequired) return "/console/change-password";
  return ["/console/dashboard", "/console/tests", "/console/reviews", "/console/review-history", "/console/orders", "/console/revenue", "/console/staff", "/console/profile"]
    .find((path) => canUseConsole(profile, consoleRoutePermission(path))) || "/console/forbidden";
}
