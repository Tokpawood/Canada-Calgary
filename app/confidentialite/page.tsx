import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, LegalPage, PublicFrame } from "@/components/PublicFrame";

export const metadata: Metadata = {
  title: `Règles de confidentialité — ${APP_NAME}`,
  description: `Comment ${APP_NAME} collecte, utilise, conserve et protège les données, dont celles reçues de Google Drive.`,
};

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 font-display text-[21px] font-extrabold">{children}</h2>;
}

const A = "font-semibold text-act underline underline-offset-2";

export default function ConfidentialitePage() {
  return (
    <PublicFrame>
      <LegalPage title="Règles de confidentialité" updated="14 novembre 2026">
        <p>
          {APP_NAME} (« l&apos;application ») est une application web privée de suivi de dossier d&apos;immigration au Canada (programme
          Entrée express). Elle est utilisée par une seule personne, le titulaire du compte ; la création de compte est fermée au public. Ces
          règles expliquent quelles données l&apos;application traite, pourquoi, où elles sont conservées et comment les supprimer.
        </p>

        <H>1. Données traitées</H>
        <ul className="list-disc pl-5">
          <li>
            <strong>Compte</strong> : adresse courriel et mot de passe (conservé uniquement sous forme hachée par le service
            d&apos;authentification), prénom, nom et photo de profil facultative.
          </li>
          <li>
            <strong>Dossier</strong> : informations saisies par le titulaire pour suivre sa démarche — étapes, échéances, documents à réunir,
            budget, épargne, contacts, historique d&apos;études et de travail, adresses, identité de référence.
          </li>
          <li>
            <strong>Fichiers</strong> : scans de documents ajoutés par le titulaire (PDF ou images).
          </li>
          <li>
            <strong>Données techniques</strong> : cookies de session strictement nécessaires à la connexion et préférence de thème
            (clair/sombre). Aucun cookie publicitaire, aucun outil de mesure d&apos;audience.
          </li>
        </ul>

        <H>2. Données échangées avec Google (Drive et Calendar)</H>
        <p>
          Le titulaire peut connecter son propre compte Google Drive pour y ranger ses fichiers. Pour Drive, l&apos;application demande uniquement
          l&apos;autorisation <code>https://www.googleapis.com/auth/drive.file</code>, qui limite son accès aux dossiers et fichiers qu&apos;elle a
          elle-même créés. Elle ne peut ni lire, ni modifier, ni lister les autres fichiers du Drive.
        </p>
        <p>
          S&apos;il active le calendrier, l&apos;application demande aussi{" "}
          <code>https://www.googleapis.com/auth/calendar.app.created</code> : elle crée un calendrier dédié et y écrit ses tâches de formation, les
          étapes du parcours et les dates d&apos;expiration de ses pièces. Elle n&apos;a pas accès à ses autres calendriers. « Arrêter » met fin à
          l&apos;envoi ; le calendrier reste chez Google, où le titulaire peut le supprimer.
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Ce qui est consulté</strong> : l&apos;adresse courriel du compte Google connecté (pour indiquer quel compte est relié), les
            identifiants des dossiers et fichiers créés par l&apos;application, et le contenu de ces fichiers lorsque le titulaire les ouvre.
          </li>
          <li>
            <strong>Ce qui est conservé</strong> : le jeton d&apos;accès de longue durée (« refresh token »), chiffré en AES-256-GCM avant
            d&apos;être enregistré ; l&apos;adresse courriel du compte Google ; les identifiants des dossiers et fichiers créés. Le contenu des
            fichiers n&apos;est pas copié sur les serveurs de l&apos;application : il transite seulement pour l&apos;envoi et l&apos;affichage.
          </li>
          <li>
            <strong>Utilisation</strong> : créer un dossier dédié dans le Drive, y envoyer les scans, les afficher, les renommer, les déplacer
            dans un sous-dossier « Fichiers remplacés » et les mettre à la corbeille, toujours à la demande du titulaire.
          </li>
          <li>
            <strong>Partage</strong> : ces données ne sont transmises à aucun tiers, ne sont pas vendues, ne servent pas à la publicité et ne
            sont pas utilisées pour entraîner des modèles d&apos;intelligence artificielle. Personne d&apos;autre que le titulaire n&apos;y a accès.
          </li>
        </ul>
        <p>
          L&apos;utilisation et le transfert, par l&apos;application, des informations reçues des API Google respectent les{" "}
          <a className={A} href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            règles relatives aux données utilisateur des services d&apos;API Google
          </a>
          , y compris les exigences d&apos;utilisation limitée (« Limited Use »).
        </p>

        <H>3. Finalités</H>
        <p>
          Les données servent exclusivement à faire fonctionner l&apos;application pour son titulaire : afficher et mettre à jour le suivi du
          dossier, conserver les documents justificatifs et, si activés, envoyer des rappels d&apos;échéance à l&apos;adresse du titulaire.
        </p>

        <H>4. Hébergement et sécurité</H>
        <ul className="list-disc pl-5">
          <li>Base de données, authentification et stockage : Supabase, région Canada.</li>
          <li>Hébergement de l&apos;application : Vercel.</li>
          <li>Fichiers rangés dans Google Drive : dans le Drive du titulaire, chez Google.</li>
          <li>
            Connexions chiffrées (HTTPS), accès aux données limité au titulaire par des règles de sécurité au niveau de la base, stockage de
            fichiers privé, jetons Google chiffrés.
          </li>
        </ul>

        <H>5. Conservation et suppression</H>
        <ul className="list-disc pl-5">
          <li>Les données sont conservées tant que le titulaire utilise l&apos;application.</li>
          <li>
            « Déconnecter Google Drive » (page Compte et sécurité) révoque le jeton auprès de Google et l&apos;efface de la base. L&apos;accès peut
            aussi être retiré depuis{" "}
            <a className={A} href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
              myaccount.google.com/permissions
            </a>
            . Les fichiers déjà rangés restent dans le Drive du titulaire, qui en garde le contrôle.
          </li>
          <li>Le titulaire peut supprimer chaque élément depuis l&apos;application, ou demander la suppression complète de son compte et de ses données.</li>
        </ul>

        <H>6. Droits</H>
        <p>Le titulaire peut accéder à ses données, les corriger, les exporter et les supprimer à tout moment depuis l&apos;application.</p>

        <H>7. Contact</H>
        <p>
          Pour toute question sur ces règles, utilisez l&apos;adresse de contact du développeur affichée sur l&apos;écran d&apos;autorisation Google
          de l&apos;application.
        </p>

        <H>8. Modifications</H>
        <p>
          Toute modification de ces règles est publiée sur cette page avec sa date de mise à jour. Voir aussi les{" "}
          <Link href="/conditions" className={A}>
            conditions d&apos;utilisation
          </Link>
          .
        </p>
      </LegalPage>
    </PublicFrame>
  );
}
