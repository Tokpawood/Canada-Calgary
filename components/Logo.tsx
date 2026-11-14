import { useId } from "react";

/**
 * Logo de l'application : un trajet pointillé qui part d'Abidjan (point) et s'envole vers Calgary (avion).
 * Animé à l'apparition (traînée qui se dessine, avion qui décolle), puis l'avion « flotte » doucement.
 */
export function Logo({ size = 40, animated = true, className = "" }: { size?: number; animated?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Projet Canada Calgary"
      className={`shrink-0 ${animated ? "logo-animated" : ""} ${className}`}
    >
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1c1c1c" />
          <stop offset="1" stopColor="#050505" />
        </linearGradient>
        <linearGradient id={`${id}trail`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#f2a33a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f2a33a" />
        </linearGradient>
        <linearGradient id={`${id}amber`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffc56b" />
          <stop offset="1" stopColor="#ee9a2a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id}bg)`} />
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="14.25" fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="1.5" />
      <path
        className="logo-trail"
        d="M18 45 Q 23 28 37.5 25.5"
        fill="none"
        stroke={`url(#${id}trail)`}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeDasharray="0.01 6.4"
      />
      <circle className="logo-halo" cx="18" cy="45" r="7.6" fill="#f2a33a" fillOpacity="0.18" />
      <circle cx="18" cy="45" r="4.4" fill="#f2a33a" />
      <g className="logo-plane">
        <g transform="translate(31.5 12) scale(0.98)">
          <path
            fill={`url(#${id}amber)`}
            d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
          />
        </g>
      </g>
    </svg>
  );
}
