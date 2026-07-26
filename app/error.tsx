"use client";

import { useEffect } from "react";

import { toast } from "sonner";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    toast.error("An unexpected error occurred", { id: "page-error" });
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-md w-full text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Oops, something went wrong</h2>
        <p className="text-slate-600 mb-6 text-sm">There was an error rendering this page.</p>
        <button
          onClick={() => reset()}
          className="px-6 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
