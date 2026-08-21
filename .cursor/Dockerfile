FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        openjdk-17-jdk \
        unzip \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && (id ubuntu >/dev/null 2>&1 || useradd -m -s /bin/bash ubuntu)

USER ubuntu
WORKDIR /home/ubuntu
