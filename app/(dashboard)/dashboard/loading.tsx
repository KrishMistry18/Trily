import { Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden bg-white/5 border border-white/10 p-4 space-y-4"
          >
            <Skeleton className="aspect-video w-full rounded-lg" />
            <div className="space-y-3">
              <Skeleton className="w-2/3 h-5" />
              <Skeleton className="w-1/2 h-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
