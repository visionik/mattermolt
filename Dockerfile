# MatterMolt Development Environment
FROM node:22-bookworm

# Install Go for Task runner
ENV GO_VERSION=1.23.5
RUN curl -OL https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf go${GO_VERSION}.linux-amd64.tar.gz && \
    rm go${GO_VERSION}.linux-amd64.tar.gz

ENV PATH="/usr/local/go/bin:${PATH}"

# Install Task (go-task)
RUN sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b /usr/local/bin

# Install common development tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    vim \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN node --version && \
    npm --version && \
    go version && \
    task --version

WORKDIR /workspace

CMD ["/bin/bash"]
