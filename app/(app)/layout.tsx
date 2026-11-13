import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DossierProvider } from "@/lib/dossier-context";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: dossier } = await supabase.from("dossier").select("id").maybeSingle();

  return (
    <DossierProvider dossierId={dossier?.id ?? null}>
      <div className="min-h-screen bg-bg">
        <header className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4">
          <Link href="/parcours" className="font-display text-lg font-bold">
            Projet Canada Calgary
          </Link>
          <SignOutButton />
        </header>
        <main className="mx-auto max-w-[1200px] px-5 pb-16">{children}</main>
      </div>
    </DossierProvider>
  );
}
