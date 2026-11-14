import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, LegalPage, PublicFrame } from "@/components/PublicFrame";

export const metadata: Metadata = {
  title: `Conditions d'utilisation — ${APP_NAME}`,
  description: `Conditions d'utilisation de ${APP_NAME}.`,
};

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 font-display text-[21px] font-extrabold">{children}</h2>;
}

export default function ConditionsPage() {
  return (
    <PublicFrame>
      <LegalPage title="Conditions d'utilisation" updated="14 novembre 2026">
        <H>1. Objet</H>
        <p>
          {APP_NAME} est un outil personnel d&apos;organisation d&apos;une demande d&apos;immigration au Canada. Il n&apos;est pas proposé au public :
          l&apos;accès est réservé au titulaire du compte et la création de compte est fermée.
        </p>
        <H>2. Absence de conseil</H>
        <p>
          L&apos;application aide à suivre des étapes et des documents. Elle ne constitue pas un avis juridique ou en immigration et n&apos;est
          pas affiliée au gouvernement du Canada (IRCC). Les informations officielles se trouvent sur canada.ca.
        </p>
        <H>3. Responsabilités du titulaire</H>
        <p>
          Le titulaire garde ses identifiants confidentiels, vérifie l&apos;exactitude des informations qu&apos;il saisit et reste responsable des
          démarches effectuées auprès des autorités.
        </p>
        <H>4. Google Drive</H>
        <p>
          La connexion à Google Drive est facultative et révocable à tout moment. Son fonctionnement est décrit dans les{" "}
          <Link href="/confidentialite" className="font-semibold text-act underline underline-offset-2">
            règles de confidentialité
          </Link>
          .
        </p>
        <H>5. Disponibilité</H>
        <p>L&apos;application est fournie en l&apos;état, sans garantie de disponibilité permanente.</p>
      </LegalPage>
    </PublicFrame>
  );
}
