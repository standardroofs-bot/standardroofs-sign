import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import PdfEditorClient from "@/components/PdfEditorClient";

export const dynamic = "force-dynamic";

export default async function PdfEditorPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell user={user}>
      <PdfEditorClient />
    </AppShell>
  );
}

