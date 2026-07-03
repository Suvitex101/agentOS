import { agentOSCore } from "@agentos/core";

const packageNames = [
  "@agentos/core",
  "@agentos/tools",
  "@agentos/memory",
  "@agentos/connectors",
  "@agentos/sdk",
  "@agentos/types",
  "@agentos/config",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-ink">
      <section className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-leaf">
            {agentOSCore.name}
          </p>
          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              Agent infrastructure for real-world workflows across the Global South.
            </h1>
            <p className="text-lg leading-8 text-slate-700">
              AgentOS is starting with a clean monorepo foundation for reasoning, memory, tools,
              connectors, and developer experience.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packageNames.map((name) => (
            <div key={name} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="font-mono text-sm font-medium text-clay">{name}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
