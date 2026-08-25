# Debian 13 picks up the libtiff DSA that bookworm still lacks.
# Trixie dropped OpenJDK 17; JDK 21 can still emit the Android jvmTarget 17.
FROM node:22-trixie-slim

ENV DEBIAN_FRONTEND=noninteractive

# The Node image vendors an older npm (tar, brace-expansion, sigstore, …).
# Stay on 11.x: npm 12 needs Node >=22.22.2 and is a breaking CLI major.
# 11.19.0 still ships tar < 7.5.21; overlay patched nested copies next.
ARG NPM_VERSION=11.19.0

RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        openjdk-21-jdk-headless \
        unzip \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g --ignore-scripts "npm@${NPM_VERSION}" \
    && corepack enable \
    && (id ubuntu >/dev/null 2>&1 || useradd -m -s /bin/bash ubuntu)

# Replace vulnerable nested copies the npm CLI still vendors (Scout High).
RUN node <<'PATCH'
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const roots = execSync("npm root -g", { encoding: "utf8" }).trim();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "npm-cve-"));
const cache = new Map();

function wanted(name, version) {
  if (name === "tar") return "7.5.22";
  if (name === "ip-address") return "10.3.1";
  if (name === "brace-expansion") {
    const major = Number.parseInt(version, 10);
    if (major <= 1) return "1.1.18";
    if (major === 2) return "2.1.4";
    if (major === 3) return "3.0.6";
    return "5.0.9";
  }
  throw new Error(`unexpected package ${name}`);
}

function fetchPkg(name, version) {
  const key = `${name}@${version}`;
  if (cache.has(key)) {
    return cache.get(key);
  }
  const dest = path.join(tmp, key.replaceAll("/", "_"));
  fs.mkdirSync(dest, { recursive: true });
  execSync(`npm install --ignore-scripts --prefix "${dest}" "${key}"`, {
    stdio: "inherit",
  });
  const pkgDir = path.join(dest, "node_modules", name);
  cache.set(key, pkgDir);
  return pkgDir;
}

const pkgFiles = execSync(
  `find "${roots}" -type f \\( -path "*/node_modules/tar/package.json" -o -path "*/node_modules/ip-address/package.json" -o -path "*/node_modules/brace-expansion/package.json" \\)`,
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

for (const pkgFile of pkgFiles) {
  const dir = path.dirname(pkgFile);
  const { name, version } = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
  const target = wanted(name, version);
  if (version === target) {
    continue;
  }
  const src = fetchPkg(name, target);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(src, dir, { recursive: true });
  console.log(`patched ${name} ${version} -> ${target} at ${dir}`);
}

fs.rmSync(tmp, { recursive: true, force: true });
PATCH

USER ubuntu
WORKDIR /home/ubuntu
