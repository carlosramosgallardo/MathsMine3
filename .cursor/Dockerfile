# Debian 13 picks up the libtiff DSA that bookworm still lacks.
# Trixie dropped OpenJDK 17; JDK 21 can still emit the Android jvmTarget 17.
FROM node:22-trixie-slim

ENV DEBIAN_FRONTEND=noninteractive

# The Node image vendors an older npm (tar, brace-expansion, sigstore, …).
# Stay on 11.x: npm 12 needs Node >=22.22.2 and is a breaking CLI major.
# 11.19.0 still ships tar < 7.5.21; overlay patched nested copies below.
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
    && (id ubuntu >/dev/null 2>&1 || useradd -m -s /bin/bash ubuntu) \
    && node <<'PATCH'
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    ...opts,
  });
  if (result.status !== 0) {
    throw new Error(
      `${cmd} failed: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout || "";
}

function wanted(name, version) {
  if (name === "tar") {
    return "7.5.22";
  }
  if (name === "ip-address") {
    return "10.3.1";
  }
  if (name === "brace-expansion") {
    const major = Number.parseInt(version, 10);
    if (major <= 1) {
      return "1.1.18";
    }
    if (major === 2) {
      return "2.1.4";
    }
    if (major === 3) {
      return "3.0.6";
    }
    return "5.0.9";
  }
  throw new Error(`unexpected package ${name}`);
}

const roots = run("npm", ["root", "-g"]).trim();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "npm-cve-"));
const cache = new Map();

function fetchPkg(name, version) {
  const key = `${name}@${version}`;
  if (cache.has(key)) {
    return cache.get(key);
  }
  const dest = path.join(tmp, key.replaceAll("/", "_"));
  fs.mkdirSync(dest, { recursive: true });
  run("npm", ["install", "--ignore-scripts", "--prefix", dest, key], {
    stdio: "inherit",
  });
  const pkgDir = path.join(dest, "node_modules", name);
  cache.set(key, pkgDir);
  return pkgDir;
}

const pkgFiles = run("find", [
  roots,
  "-type",
  "f",
  "(",
  "-path",
  "*/node_modules/tar/package.json",
  "-o",
  "-path",
  "*/node_modules/ip-address/package.json",
  "-o",
  "-path",
  "*/node_modules/brace-expansion/package.json",
  ")",
])
  .split("\n")
  .filter(Boolean);

for (const pkgFile of pkgFiles) {
  const dir = path.dirname(pkgFile);
  const { name, version } = JSON.parse(
    fs.readFileSync(pkgFile, "utf8"),
  );
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
