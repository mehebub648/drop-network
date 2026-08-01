#!/bin/sh
set -e

# The data dir is a mounted volume. If it pre-exists with foreign ownership
# (e.g. root-owned files from an older image), fix it so the unprivileged
# "node" user can read/write LanceDB files. Only meaningful when started as
# root; drop to "node" afterwards.
if [ "$(id -u)" = "0" ]; then
  datastore_path="${LANCEDB_PATH:-/data/lancedb}"
  community_media_path="${COMMUNITY_MEDIA_PATH:-/data/media/community}"
  mkdir -p "$datastore_path" "$community_media_path"
  chown -R node:node "$datastore_path" "$community_media_path"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

exec "$@"
