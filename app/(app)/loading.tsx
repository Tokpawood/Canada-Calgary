/** Squelette affiché pendant le chargement d'une page : mêmes volumes que le contenu réel, sans saut à l'arrivée. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement" className="anim-fade">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-4 w-80 max-w-full" />
        </div>
        <div className="skeleton hidden h-9 w-28 sm:block" />
      </div>
      <div className="overflow-hidden rounded-[20px] bg-night p-5 ring-1 ring-white/[0.06] sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
          <div className="flex flex-1 flex-col gap-3">
            <div className="skeleton-dark h-3 w-40 rounded-md" />
            <div className="skeleton-dark h-14 w-56 rounded-xl" />
            <div className="skeleton-dark h-3 w-72 max-w-full rounded-md" />
          </div>
          <div className="grid grid-cols-2 gap-2 xl:w-[360px]">
            <div className="skeleton-dark h-24 rounded-xl" />
            <div className="skeleton-dark h-24 rounded-xl" />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-dark h-8 w-24 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-32" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    </div>
  );
}
