export const alphaVersion = "0.1.0-alpha.1";

export const publishablePackages = [
  {
    name: "@agentosdev/types",
    directory: "packages/types",
    tarballPrefix: "agentosdev-types",
    decision: "publishable now",
  },
  {
    name: "@agentosdev/memory",
    directory: "packages/memory",
    tarballPrefix: "agentosdev-memory",
    decision: "publishable now",
  },
  {
    name: "@agentosdev/core",
    directory: "packages/core",
    tarballPrefix: "agentosdev-core",
    decision: "publishable now",
  },
  {
    name: "@agentosdev/providers",
    directory: "packages/providers",
    tarballPrefix: "agentosdev-providers",
    decision: "publishable now",
  },
  {
    name: "@agentosdev/connectors",
    directory: "packages/connectors",
    tarballPrefix: "agentosdev-connectors",
    decision: "publishable now",
  },
  {
    name: "@agentosdev/sdk",
    directory: "packages/sdk",
    tarballPrefix: "agentosdev-sdk",
    decision: "primary public entry point",
  },
];

export const privatePackages = [
  {
    name: "@agentosdev/tools",
    directory: "packages/tools",
    decision: "placeholder package; keep private until real public tool helpers exist",
  },
  {
    name: "@agentosdev/config",
    directory: "packages/config",
    decision: "internal development configuration; keep private",
  },
  {
    name: "@agentosdev/web",
    directory: "apps/web",
    decision: "future dashboard app; not an npm package",
  },
];

export const allReleasePackages = [...publishablePackages, ...privatePackages];
