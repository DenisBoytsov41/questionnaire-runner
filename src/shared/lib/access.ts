import type { UserRole } from "../api/backendApi";

export function isAdminRole(role: UserRole): boolean {
  return role === "admin" || role === "superadmin";
}

export function canManageUser(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === "superadmin") {
    return targetRole !== "superadmin";
  }

  return actorRole === "admin" && targetRole !== "admin" && targetRole !== "superadmin";
}
