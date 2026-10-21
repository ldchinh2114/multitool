/**
 * Instant feedback while a tool route is being fetched.
 *
 * The tool pages are prerendered and their payloads are prefetched by the
 * header links, so this skeleton is only visible on a cold or slow connection.
 */
export default function ToolsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-pulse rounded-2xl bg-gray-200" />
          <div className="mx-auto h-8 w-64 animate-pulse rounded-lg bg-gray-200" />
          <div className="mx-auto mt-3 h-4 w-80 animate-pulse rounded bg-gray-200" />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
          <div className="mt-3 h-12 w-full animate-pulse rounded-lg bg-gray-200" />
          <div className="mt-6 flex items-center gap-4">
            <div className="h-12 flex-1 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-12 w-12 animate-pulse rounded-full bg-gray-200" />
            <div className="h-12 flex-1 animate-pulse rounded-lg bg-gray-200" />
          </div>
          <div className="mt-6 h-28 w-full animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
