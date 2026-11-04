import { ownerEmail } from "./config";

export function authorizeOwnerEmail(
  email: string | null | undefined,
  expected = ownerEmail(),
): boolean {
  return Boolean(email) && email!.toLowerCase() === expected.toLowerCase();
}
