#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VERSION="0.1.0"

echo "=== Building File Dispatch Flatpak ==="

# Check for required tools
if ! command -v flatpak &> /dev/null; then
    echo "Error: flatpak is not installed"
    exit 1
fi

# Ensure org.flatpak.Builder is installed
if ! flatpak list --app | grep -q org.flatpak.Builder; then
    echo "Installing org.flatpak.Builder..."
    flatpak install -y flathub org.flatpak.Builder
fi

# Ensure shared-modules are present
if [ ! -d "$SCRIPT_DIR/shared-modules" ]; then
    echo "Cloning flathub shared-modules..."
    git clone --depth 1 https://github.com/flathub/shared-modules.git "$SCRIPT_DIR/shared-modules"
fi

# Build the Tauri app first if binary doesn't exist
BINARY="$PROJECT_DIR/src-tauri/target/release/file-dispatch"
if [ ! -f "$BINARY" ]; then
    echo "Binary not found. Building Tauri app first..."
    cd "$PROJECT_DIR"
    # Use distrobox if available (for immutable distros like Bazzite)
    if command -v distrobox &> /dev/null && distrobox list | grep -q filedispatch; then
        distrobox enter filedispatch -- bash -c "NO_STRIP=1 bun tauri build --bundles none"
    else
        NO_STRIP=1 bun tauri build --bundles none
    fi
fi

# Build the Flatpak
cd "$SCRIPT_DIR"
echo "Building Flatpak..."
flatpak run org.flatpak.Builder --force-clean --user --install build-dir com.filedispatch.FileDispatch.yml

# Create bundle for distribution
echo "Creating distributable bundle..."
flatpak build-bundle ~/.local/share/flatpak/repo "FileDispatch-$VERSION.flatpak" com.filedispatch.FileDispatch \
    --runtime-repo=https://flathub.org/repo/flathub.flatpakrepo

echo ""
echo "=== Build Complete ==="
echo "Installed: flatpak run com.filedispatch.FileDispatch"
echo "Bundle: $SCRIPT_DIR/FileDispatch-$VERSION.flatpak"
echo ""
echo "To install the bundle on another machine:"
echo "  flatpak install FileDispatch-$VERSION.flatpak"
