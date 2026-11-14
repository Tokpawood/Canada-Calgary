/** Pastille ronde : photo de profil, ou initiales sur fond ambré. */
export function Avatar({ url, initials, size = 36, className = "" }: { url: string | null; initials: string; size?: number; className?: string }) {
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#ffc56b] to-[#ee9a2a] font-display font-bold text-[#1b1206] ring-2 ring-white/10 ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire du stockage privé
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  );
}
