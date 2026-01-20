## Flatpak build (local)

This manifest is meant for local testing and uses Bun to build the frontend.

### Build and run

```bash
flatpak-builder --force-clean --install-deps-from=flathub --user --install build-dir flatpak/com.filedispatch.app.yml
flatpak run com.filedispatch.app
```

### Notes

- The manifest downloads Bun (v1.3.6) during the build.
- For Flathub, you will need a source-only build (no network access during build).
