import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { alphaVersion, privatePackages, publishablePackages } from "./release-packages.mjs";

const root = process.cwd();
const outputDirectory = path.join(root, ".release", "npm-preflight");
const npmCacheDirectory = path.join(outputDirectory, "npm-cache");
const failures = [];
const warnings = [];

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

const publishable = publishablePackages.map((pkg) => ({
  ...pkg,
  manifest: readJson(path.join(root, pkg.directory, "package.json")),
}));
const privateManifests = privatePackages.map((pkg) => ({
  ...pkg,
  manifest: readJson(path.join(root, pkg.directory, "package.json")),
}));
const publicationOrder = computePublicationOrder(publishable);

console.log("AgentOS npm release preflight");
console.log(`Target version: ${alphaVersion}`);
console.log(`Target dist-tag: alpha`);
console.log("");

console.log("Publishable packages:");
for (const pkg of publishable) {
  const isPrivate = pkg.manifest.private === true;
  console.log(`- ${pkg.name}@${pkg.manifest.version} (${isPrivate ? "private" : "public"})`);
  assert(pkg.manifest.version === alphaVersion, `${pkg.name} is not ${alphaVersion}`);
  assert(!isPrivate, `${pkg.name} must not be private`);
  assert(pkg.manifest.license === "Apache-2.0", `${pkg.name} must declare Apache-2.0`);
  assert(Boolean(pkg.manifest.repository?.url), `${pkg.name} is missing repository metadata`);
  assert(Boolean(pkg.manifest.homepage), `${pkg.name} is missing homepage metadata`);
  assert(Boolean(pkg.manifest.bugs?.url), `${pkg.name} is missing bugs metadata`);
}

console.log("");
console.log("Private packages:");
for (const pkg of privateManifests) {
  console.log(`- ${pkg.name}@${pkg.manifest.version} (private: ${String(pkg.manifest.private)})`);
  assert(pkg.manifest.private === true, `${pkg.name} must remain private`);
}

console.log("");
console.log("Dependency-aware publication order:");
publicationOrder.forEach((pkg, index) => {
  console.log(`${index + 1}. ${pkg.name}`);
});

console.log("");
console.log("Dependency relationships:");
for (const pkg of publicationOrder) {
  const dependencies = Object.entries(pkg.manifest.dependencies ?? {}).filter(([name]) =>
    name.startsWith("@agentosdev/")
  );
  const label = dependencies.length
    ? dependencies.map(([name, specifier]) => `${name}@${specifier}`).join(", ")
    : "none";
  console.log(`- ${pkg.name}: ${label}`);
}

console.log("");
console.log("Packing and inspecting tarballs:");
for (const pkg of publicationOrder) {
  const tarballPath = packPackage(pkg);

  if (!tarballPath) {
    continue;
  }

  const size = statSync(tarballPath).size;
  const contents = listTarballContents(tarballPath);
  const packedManifest = readPackedManifest(tarballPath);
  const workspaceReferences = findWorkspaceReferences(packedManifest);

  console.log(`- ${pkg.name}`);
  console.log(`  tarball: ${path.basename(tarballPath)}`);
  console.log(`  version: ${packedManifest.version}`);
  console.log(`  size: ${formatBytes(size)}`);
  console.log(`  files:`);
  for (const file of contents) {
    console.log(`    - ${file}`);
  }
  console.log(`  dependencies: ${formatDependencies(packedManifest.dependencies)}`);

  assert(packedManifest.name === pkg.name, `${pkg.name} tarball manifest has wrong name`);
  assert(packedManifest.version === alphaVersion, `${pkg.name} tarball manifest has wrong version`);
  assert(
    packedManifest.exports?.["."]?.import === "./dist/index.js",
    `${pkg.name} tarball export map must point to dist/index.js`
  );
  assert(
    packedManifest.exports?.["."]?.types === "./dist/index.d.ts",
    `${pkg.name} tarball export map must point to dist/index.d.ts`
  );
  assert(workspaceReferences.length === 0, `${pkg.name} still has workspace references`);

  const registryStatus = checkRegistryVersion(pkg.name, alphaVersion);
  console.log(`  npm registry: ${registryStatus}`);
}

if (warnings.length > 0) {
  console.log("");
  console.log("Warnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

if (failures.length > 0) {
  console.error("");
  console.error("Preflight failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("");
  console.log("Preflight completed without release-blocking package issues.");
}

function computePublicationOrder(packages) {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const visited = new Set();
  const visiting = new Set();
  const ordered = [];

  function visit(pkg) {
    if (visited.has(pkg.name)) {
      return;
    }

    if (visiting.has(pkg.name)) {
      failures.push(`Circular package dependency detected at ${pkg.name}`);
      return;
    }

    visiting.add(pkg.name);

    for (const dependencyName of Object.keys(pkg.manifest.dependencies ?? {})) {
      const dependency = byName.get(dependencyName);

      if (dependency) {
        visit(dependency);
      }
    }

    visiting.delete(pkg.name);
    visited.add(pkg.name);
    ordered.push(pkg);
  }

  for (const pkg of packages) {
    visit(pkg);
  }

  return ordered;
}

function packPackage(pkg) {
  const result = spawnSync(
    "pnpm",
    ["--dir", path.join(root, pkg.directory), "pack", "--pack-destination", outputDirectory],
    {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
    }
  );

  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    failures.push(`Failed to pack ${pkg.name}`);
    return "";
  }

  const packedFile = result.stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.endsWith(".tgz"));

  if (!packedFile) {
    failures.push(`Could not determine tarball file for ${pkg.name}`);
    return "";
  }

  return path.isAbsolute(packedFile) ? packedFile : path.join(outputDirectory, packedFile);
}

function listTarballContents(tarballPath) {
  if (!tarballPath) {
    return [];
  }

  const result = spawnSync("tar", ["-tf", tarballPath], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    failures.push(`Could not list tarball contents for ${path.basename(tarballPath)}`);
    return [];
  }

  return result.stdout
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((entry) => entry.replace(/^package\//, ""));
}

function readPackedManifest(tarballPath) {
  if (!tarballPath) {
    return {};
  }

  const result = spawnSync("tar", ["-xOf", tarballPath, "package/package.json"], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    failures.push(`Could not read packed manifest for ${path.basename(tarballPath)}`);
    return {};
  }

  return JSON.parse(result.stdout);
}

function findWorkspaceReferences(manifest) {
  const sections = ["dependencies", "peerDependencies", "optionalDependencies"];
  const references = [];

  for (const section of sections) {
    for (const [name, specifier] of Object.entries(manifest[section] ?? {})) {
      if (typeof specifier === "string" && specifier.startsWith("workspace:")) {
        references.push(`${section}.${name}=${specifier}`);
      }
    }
  }

  return references;
}

function checkRegistryVersion(name, version) {
  const result = spawnSync(
    "npm",
    ["--cache", npmCacheDirectory, "view", `${name}@${version}`, "version", "--json"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 15000,
    }
  );

  if (result.status === 0 && result.stdout.trim()) {
    failures.push(`${name}@${version} already exists on npm`);
    return "version already exists";
  }

  const combinedOutput = `${result.stdout}\n${result.stderr}`;

  if (/E404|404 Not Found/i.test(combinedOutput)) {
    return "version not found";
  }

  warnings.push(
    `Could not verify npm registry status for ${name}: registry unavailable or blocked`
  );
  return "not verified";
}

function formatDependencies(dependencies = {}) {
  const entries = Object.entries(dependencies);

  if (entries.length === 0) {
    return "none";
  }

  return entries.map(([name, specifier]) => `${name}@${specifier}`).join(", ");
}

function formatBytes(value) {
  if (value < 1024) {
    return `${value} B`;
  }

  return `${(value / 1024).toFixed(1)} kB`;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
