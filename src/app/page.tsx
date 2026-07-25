const pillars = [
  {
    title: "Farmer logistics",
    body: "Fixed, transparent rates and reliable transport from farm to city storage — no broker exploitation on weight or price.",
  },
  {
    title: "Store analytics",
    body: "Digital store tooling that measures market success per city and produce, so vendors know what sells where.",
  },
  {
    title: "Grocery delivery",
    body: "An Uber-Eats-style consumer app delivering produce below supermarket prices, giving vendors direct market access.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-20">
      <div className="w-full max-w-3xl">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
          Fairer food distribution, powered by AI orchestration.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Impact Lab connects farmers, stores, and consumers into one supply
          chain — routing existing AI models to price, forecast, and optimize
          each step.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {pillars.map((p) => (
            <section
              key={p.title}
              className="rounded-2xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-950"
            >
              <h2 className="font-medium text-black dark:text-zinc-50">
                {p.title}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {p.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
