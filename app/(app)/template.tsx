/** Gabarit des pages connectées : rejoué à chaque navigation, il fait entrer le contenu en cascade. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
