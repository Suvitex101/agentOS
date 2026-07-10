import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const targetDirectory = process.argv[2];

if (!targetDirectory) {
  throw new Error("Usage: node scripts/fix-esm-extensions.mjs <dist-directory>");
}

const absoluteTarget = path.resolve(process.cwd(), targetDirectory);

for (const file of listJavaScriptFiles(absoluteTarget)) {
  const original = readFileSync(file, "utf8");
  const updated = original.replace(
    /(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g,
    (match, prefix, specifier, suffix) => {
      if ([".js", ".json", ".node"].includes(path.extname(specifier))) {
        return match;
      }

      return `${prefix}${specifier}.js${suffix}`;
    }
  );

  if (updated !== original) {
    writeFileSync(file, updated);
  }
}

function listJavaScriptFiles(directory) {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...listJavaScriptFiles(fullPath));
    } else if (fullPath.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}
