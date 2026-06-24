#!/bin/sh
set -e

# The data dir is a mounted volume. If it pre-exists with foreign ownership
# (e.g. root-owned files from an older image), fix it so the unprivileged
# "node" user can read/write LanceDB files. Only meaningful when started as
# root; drop to "node" afterwards.
if [ "$(id -u)" = "0" ]; then
  chown -R node:node "${LANCEDB_PATH:-/data/lancedb}"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

exec "$@"
