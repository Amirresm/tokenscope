FROM nvidia/cuda:13.1.1-runtime-ubuntu24.04

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    xz-utils \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_VERSION=24.12.0

RUN curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz \
    | tar -xJ -C /usr/local --strip-components=1

RUN node -v && npm -v

COPY --from=ghcr.io/astral-sh/uv:0.9.26 /uv /uvx /bin/

ENV PYTHON_VERSION=3.13.2

RUN uv python install ${PYTHON_VERSION}

RUN uv venv /app/.venv --python ${PYTHON_VERSION}

ENV PATH="/app/.venv/bin:$PATH"

COPY pyproject.toml uv.lock /app/

RUN uv sync

COPY ui2/package*.json /app/ui2/

WORKDIR /app/ui2

RUN npm install

WORKDIR /app

COPY . /app/

WORKDIR /app/ui2

RUN npm run build

WORKDIR /app

CMD ["python3", "main.py"]

