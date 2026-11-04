import { redirect } from "next/navigation";
import { authorizeOwnerEmail, getSession } from "@/lib/auth";
import { mailMode, ownerEmail } from "@/lib/config";
import { firebaseAdminConfigured } from "@/lib/firebase/admin";
import { getStore } from "@/lib/store";
import PilotDashboard from "./PilotDashboard";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  if (!firebaseAdminConfigured()) redirect("/login?error=firebase-not-configured");

  const session = await getSession();
  if (!session) redirect("/login");
  if (!authorizeOwnerEmail(session.email, ownerEmail())) redirect("/login?error=unauthorized");

  const store = await getStore();
  const snapshot = await store.getSnapshot();

  return (
    <PilotDashboard
      initial={snapshot}
      ownerEmail={ownerEmail()}
      mailMode={mailMode()}
    />
  );
}
