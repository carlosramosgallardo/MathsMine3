# Debian 13 picks up the libtiff DSA that bookworm still lacks.
FROM node:22-trixie-slim

ENV DEBIAN_FRONTEND=noninteractive

# The Node image vendors an older npm (tar, brace-expansion, sigstore, …).
# Stay on 11.x: npm 12 needs Node >=22.22.2 and is a breaking CLI major.
ARG NPM_VERSION=11.19.0

RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        openjdk-17-jdk \
        unzip \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g --ignore-scripts "npm@${NPM_VERSION}" \
    && corepack enable \
    && (id ubuntu >/dev/null 2>&1 || useradd -m -s /bin/bash ubuntu)

USER ubuntu
WORKDIR /home/ubuntu
