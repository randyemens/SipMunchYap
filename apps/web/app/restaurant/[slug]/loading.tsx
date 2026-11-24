export default function RestaurantLoading() {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background">
      <section className="border-b border-line bg-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8 lg:px-10">
          <div className="mb-5 h-4 w-28 animate-pulse rounded bg-tint-strong" />
          <div className="flex items-start gap-5 md:gap-7">
            <div className="h-28 w-28 shrink-0 animate-pulse rounded-2xl bg-tint-strong md:h-36 md:w-36" />
            <div className="min-w-0 flex-1 space-y-3 pt-2">
              <div className="h-9 w-2/3 max-w-md animate-pulse rounded bg-tint-strong" />
              <div className="h-5 w-40 animate-pulse rounded bg-tint-strong" />
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-8 md:px-8 lg:grid-cols-3 lg:gap-8 lg:px-10 lg:py-10">
          <div className="h-64 animate-pulse rounded-2xl bg-tint lg:col-span-2" />
          <div className="space-y-6">
            <div className="h-40 animate-pulse rounded-2xl bg-tint" />
            <div className="h-40 animate-pulse rounded-2xl bg-tint" />
          </div>
        </div>
      </section>
    </main>
  );
}
