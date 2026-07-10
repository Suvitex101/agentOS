import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { publishablePackages } from "./release-packages.mjs";

const root = process.cwd();
const outputDirectory = path.join(root, ".release", "pack");

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

const tarballs = [];

for (const pkg of publishablePackages) {
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
    throw new Error(`Failed to pack ${pkg.name}.`);
  }

  const packedFile = result.stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.endsWith(".tgz"));

  if (!packedFile) {
    process.stdout.write(result.stdout);
    throw new Error(`Could not determine tarball path for ${pkg.name}.`);
  }

  const tarballPath = path.isAbsolute(packedFile)
    ? packedFile
    : path.join(outputDirectory, packedFile);

  tarballs.push({
    name: pkg.name,
    path: tarballPath,
  });
}

writeFileSync(
  path.join(outputDirectory, "tarballs.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      tarballs,
    },
    null,
    2
  )
);

console.log(`Packed ${tarballs.length} packages into ${path.relative(root, outputDirectory)}.`);

for (const tarball of tarballs) {
  const manifest = JSON.parse(
    spawnSync("tar", ["-xOf", tarball.path, "package/package.json"], {
      encoding: "utf8",
    }).stdout
  );

  console.log(`- ${tarball.name} -> ${path.basename(tarball.path)} (${manifest.version})`);
  assertPackedManifest(tarball.name, manifest);
}

function assertPackedManifest(name, manifest) {
  if (manifest.exports?.["."]?.import !== "./dist/index.js") {
    throw new Error(`${name} packed manifest does not expose dist/index.js.`);
  }

  if (manifest.exports?.["."]?.types !== "./dist/index.d.ts") {
    throw new Error(`${name} packed manifest does not expose dist/index.d.ts.`);
  }

  const manifestText = readFileSync(
    path.join(root, publishablePackages.find((pkg) => pkg.name === name).directory, "package.json"),
    "utf8"
  );

  if (manifestText.includes('"./src/index.ts"')) {
    throw new Error(`${name} source manifest still exposes src/index.ts.`);
  }
}
