#!/usr/bin/env bash
#MISE description="Build an unmodified static musl guest"
# Compile an already resolved source tree to a static musl guest.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
tool=${1:?tool required}
source_dir=${2:?source required}
out=${3:?output required}
target=x86_64-unknown-linux-musl
export CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER=musl-gcc
export CC_x86_64_unknown_linux_musl=musl-gcc
export CARGO_TARGET_DIR=${CARGO_TARGET_DIR:-$out/cargo}
cargo_bin=$(cd "$root" && MISE_AUTO_INSTALL=0 mise exec rust -- rustup which cargo)
rust_bin=$(dirname "$cargo_bin")
export RUSTC="$rust_bin/rustc"
export PATH="$rust_bin:$PATH"
cd "$source_dir"
config=$(jq -ce --arg tool "$tool" '.[$tool].native | select(.kind == "cargo")' "$root/web/tools.json") ||
  { echo "no native guest builder: $tool" >&2; exit 1; }
binary=$(jq -er .binary <<<"$config")
package=$(jq -r '.package // empty' <<<"$config")
[[ $binary =~ ^[a-zA-Z0-9_-]+$ && $package =~ ^[a-zA-Z0-9_-]*$ ]] ||
  { echo 'invalid Cargo build configuration' >&2; exit 1; }
if [[ $(jq -r '.primer // false' <<<"$config") == true ]]; then
  : > "$out/empty-primer.rkyv.zst"
  export AUBE_PRIMER_PATH="$out/empty-primer.rkyv.zst"
fi
if [[ $(jq -r '.ui // false' <<<"$config") == true ]]; then
  export PATH="$out:$PATH" AUBE_NO_UPDATE_CHECK=1
  node_bin=$(cd "$root" && mise where node@24.21.0)/bin
  (
    cd ui
    export PATH="$node_bin:$PATH"
    aube install --frozen-lockfile
    aube run build
    test -f dist/index.html
  )
fi
args=(build --release --locked --target "$target" --bin "$binary")
if [[ -n $package ]]; then args+=(-p "$package"); fi
"$cargo_bin" "${args[@]}"
install -m 0755 "$CARGO_TARGET_DIR/$target/release/$binary" "$out/$tool"
