import type { Role } from "./types";

export function governanceCapabilities(
  role: Role | null,
  commerceReleaseEnabled: boolean,
) {
  const privileged = role === "owner" || role === "admin";
  return {
    canManage: privileged,
    canRunAgents: privileged,
    canApprove: privileged,
    canPublish: privileged && commerceReleaseEnabled,
    readOnly: role === "viewer",
    publishingReason: commerceReleaseEnabled
      ? privileged
        ? null
        : "Owner or administrator access required."
      : "Publishing is locked until the commerce safety release is approved.",
  };
}

export function cronGovernanceStatus(
  authorization: string,
  secret: string,
  autonomyEnabled: boolean,
): 401 | 423 | 503 | null {
  if (!secret) return 503;
  if (authorization !== `Bearer ${secret}`) return 401;
  if (!autonomyEnabled) return 423;
  return null;
}
