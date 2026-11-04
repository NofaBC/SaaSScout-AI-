import { redirect } from "next/navigation";
import { authorizeOwnerEmail, getSession } from "@/lib/auth";
import { appMode, mailMode, ownerEmail } from "@/lib/config";
import { getStore } from "@/lib/store";
import PilotDashboard from "./PilotDashboard";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!authorizeOwnerEmail(session.email, ownerEmail())) redirect("/login?error=unauthorized");

  const store = await getStore();
  const snapshot = await store.getSnapshot();

  return (
    <PilotDashboard
      initial={snapshot}
      ownerEmail={ownerEmail()}
      authMode={appMode()}
      mailMode={mailMode()}
    />
  );
}
