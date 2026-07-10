import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { alphaVersion, privatePackages, publishablePackages } from "./release-packages.mjs";

const root = process.cwd();
const failures = [];

for (const pkg of publishablePackages) {
  const manifest = readJson(path.join(root, pkg.directory, "package.json"));

  expect(manifest.name === pkg.name, `${pkg.directory} package name should be ${pkg.name}`);
  expect(manifest.version === alphaVersion, `${pkg.name} should use ${alphaVersion}`);
  expect(manifest.private !== true, `${pkg.name} should be publishable`);
  expect(manifest.type === "module", `${pkg.name} should be an ESM package`);
  expect(manifest.main === "./dist/index.js", `${pkg.name} main should point to dist`);
  expect(manifest.types === "./dist/index.d.ts", `${pkg.name} types should point to dist`);
  expect(Boolean(manifest.license), `${pkg.name} should declare a license`);
  expect(Boolean(manifest.repository), `${pkg.name} should declare repository metadata`);
  expect(Boolean(manifest.exports?.["."]), `${pkg.name} should define a root export map`);
  expect(
    manifest.exports?.["."]?.import === "./dist/index.js",
    `${pkg.name} export map should expose dist/index.js`
  );
  expect(
    manifest.exports?.["."]?.types === "./dist/index.d.ts",
    `${pkg.name} export map should expose dist/index.d.ts`
  );
  expect(
    Array.isArray(manifest.files) && manifest.files.includes("dist"),
    `${pkg.name} should publish only declared package files`
  );

  for (const [dependencyName, specifier] of Object.entries(manifest.dependencies ?? {})) {
    if (dependencyName.startsWith("@agentos/")) {
      expect(
        specifier === "workspace:^",
        `${pkg.name} should use workspace:^ for ${dependencyName}`
      );
    }
  }

  const distIndex = path.join(root, pkg.directory, "dist/index.js");
  const distTypes = path.join(root, pkg.directory, "dist/index.d.ts");

  if (process.argv.includes("--check-dist")) {
    expect(existsSync(distIndex), `${pkg.name} is missing dist/index.js`);
    expect(existsSync(distTypes), `${pkg.name} is missing dist/index.d.ts`);
    scanDistForExtensionlessImports(path.join(root, pkg.directory, "dist"), pkg.name);
  }
}

for (const pkg of privatePackages) {
  const manifest = readJson(path.join(root, pkg.directory, "package.json"));

  expect(manifest.private === true, `${pkg.name} should remain private`);
}

for (const sourceFile of listFiles(path.join(root, "packages"), ".ts")) {
  const contents = readFileSync(sourceFile, "utf8");
  const relative = path.relative(root, sourceFile);

  expect(
    !/@agentos\/[^"']+\/src\b/.test(contents),
    `${relative} imports another package private src path`
  );
}

if (failures.length > 0) {
  console.error("Package boundary validation failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exitCode = 1;
} else {
  console.log("Package boundary validation passed.");
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function listFiles(directory, extension) {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...listFiles(fullPath, extension));
    } else if (fullPath.endsWith(extension)) {
      files.push(fullPath);
    }
  }

  return files;
}

function scanDistForExtensionlessImports(directory, packageName) {
  if (!existsSync(directory)) {
    return;
  }

  for (const file of listFiles(directory, ".js")) {
    const contents = readFileSync(file, "utf8");
    const matches = contents.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g);

    for (const match of matches) {
      const specifier = match[1];

      if (
        specifier &&
        !specifier.endsWith(".js") &&
        !specifier.endsWith(".json") &&
        !specifier.endsWith(".node")
      ) {
        failures.push(
          `${packageName} has extensionless ESM import "${specifier}" in ${path.relative(
            root,
            file
          )}`
        );
      }
    }
  }
}
