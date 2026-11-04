import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { firebaseAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!firebaseAdminConfigured()) redirect("/login");
  const session = await getSession();
  redirect(session ? "/app" : "/login");
}
