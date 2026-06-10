import type { UserRole } from "../types.js";

export function isAdminRole(role: UserRole): boolean {
  return role === "admin" || role === "superadmin";
}

export function canManageUserRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === "superadmin") {
    return targetRole !== "superadmin";
  }

  return actorRole === "admin" && targetRole !== "admin" && targetRole !== "superadmin";
}

export function canAssignUserRole(actorRole: UserRole, nextRole: UserRole): boolean {
  if (actorRole === "superadmin") {
    return nextRole !== "superadmin";
  }

  return actorRole === "admin" && nextRole !== "admin" && nextRole !== "superadmin";
}
