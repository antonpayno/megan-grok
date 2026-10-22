import { Skeleton } from "../../components/ui/Skeleton";

/** Esqueleto con la misma altura que PostCard, para no saltar al cargar. */
export function PostCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="flex items-center gap-2.5 px-3.5 pt-3">
        <Skeleton className="size-9 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-2.5 w-20" />
        </div>
        <Skeleton className="ml-auto h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-2.5 aspect-square w-full rounded-none" />
      <div className="space-y-2 px-3.5 py-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <div className="flex gap-3 pt-1">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-12" />
        </div>
        <Skeleton className="h-9 w-full rounded-full" />
      </div>
    </div>
  );
}

export function PostGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="aspect-square w-full rounded-lg" />
      ))}
    </div>
  );
}
