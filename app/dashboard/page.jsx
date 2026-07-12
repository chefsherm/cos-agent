import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import DashboardClient from "./DashboardClient";

export const metadata = { title: "Operator dashboard — Candidate Collective" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <DashboardClient user={user} />;
}
