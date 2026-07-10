export const alphaVersion = "0.1.0-alpha.1";

export const publishablePackages = [
  {
    name: "@agentos/types",
    directory: "packages/types",
    tarballPrefix: "agentos-types",
    decision: "publishable now",
  },
  {
    name: "@agentos/memory",
    directory: "packages/memory",
    tarballPrefix: "agentos-memory",
    decision: "publishable now",
  },
  {
    name: "@agentos/core",
    directory: "packages/core",
    tarballPrefix: "agentos-core",
    decision: "publishable now",
  },
  {
    name: "@agentos/connectors",
    directory: "packages/connectors",
    tarballPrefix: "agentos-connectors",
    decision: "publishable now",
  },
  {
    name: "@agentos/providers",
    directory: "packages/providers",
    tarballPrefix: "agentos-providers",
    decision: "publishable now",
  },
  {
    name: "@agentos/sdk",
    directory: "packages/sdk",
    tarballPrefix: "agentos-sdk",
    decision: "primary public entry point",
  },
];

export const privatePackages = [
  {
    name: "@agentos/tools",
    directory: "packages/tools",
    decision: "placeholder package; keep private until real public tool helpers exist",
  },
  {
    name: "@agentos/config",
    directory: "packages/config",
    decision: "internal development configuration; keep private",
  },
  {
    name: "@agentos/web",
    directory: "apps/web",
    decision: "future dashboard app; not an npm package",
  },
];

export const allReleasePackages = [...publishablePackages, ...privatePackages];
