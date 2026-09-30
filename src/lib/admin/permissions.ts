/** M1 entitlement vocabulary. These values do not authorize browser operations. */
export const capabilityScopes = {
  "workspace.access": ["all"],
  "crm.intake": ["all"],
  "crm.create": ["all"],
  "crm.read": ["assigned", "all"],
  "crm.update": ["assigned", "all"],
  "crm.stage": ["assigned", "all"],
  "crm.assign": ["assigned", "all"],
  "crm.notes.write": ["assigned", "all"],
  "crm.followups.manage": ["assigned", "all"],
  "clients.read": ["assigned", "all"],
  "clients.convert": ["assigned", "all"],
  "reports.crm.read": ["assigned", "all"],
} as const;

export type Capability = keyof typeof capabilityScopes;
export type PermissionScope = "assigned" | "all";
export type PermissionGrant = {
  [C in Capability]: { capability: C; scope: (typeof capabilityScopes)[C][number] }
}[Capability];

export function isPermissionGrant(capability: unknown, scope: unknown): boolean {
  return typeof capability === "string" && Object.hasOwn(capabilityScopes, capability)
    && typeof scope === "string"
    && (capabilityScopes[capability as Capability] as readonly string[]).includes(scope);
}
