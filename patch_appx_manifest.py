"""
Post-build: patch AppxManifest.xml directly inside the APPX ZIP.

electron-builder only declares Square44x44Logo, Square150x150Logo, Wide310x150Logo.
Microsoft Store requires all tile sizes — missing ones fall back to default icon.

Direct ZIP modification is safe because:
- APPX uses STORE (no compression), so manifest is stored as-is
- Windows falls back to full verification if BlockMap is stale
- Microsoft Store ingestion re-processes and re-signs the package

Run AFTER `npm run build:msix`:
    python patch_appx_manifest.py
"""
import os
import re
import sys
import zipfile


RELEASE_DIR = "release"


def find_appx():
    for f in os.listdir(RELEASE_DIR):
        if f.endswith(".appx"):
            return os.path.join(RELEASE_DIR, f)
    return None


def patch_content(manifest):
    """Add Square71x71Logo and Square310x310Logo."""
    # VisualElements attributes
    patched = re.sub(
        r'(Square44x44Logo="assets\\Square44x44Logo\.png")',
        r'\1\n'
        r'       Square71x71Logo="assets\\Square71x71Logo.png"\n'
        r'       Square310x310Logo="assets\\Square310x310Logo.png"',
        manifest,
    )
    # DefaultTile attributes
    patched = re.sub(
        r'(<uap:DefaultTile\s+Wide310x150Logo="assets\\Wide310x150Logo\.png")',
        r'\1'
        r' Square310x310Logo="assets\\Square310x310Logo.png"'
        r' Square71x71Logo="assets\\Square71x71Logo.png"',
        patched,
    )
    return patched


if __name__ == "__main__":
    appx_path = find_appx()
    if not appx_path:
        print("ERROR: No .appx found in release/")
        sys.exit(1)

    print(f"Found: {appx_path}")

    # Read manifest from APPX
    with zipfile.ZipFile(appx_path, "r") as z:
        original = z.read("AppxManifest.xml").decode("utf-8")

    # Already patched?
    if "Square71x71Logo" in original and "Square310x310Logo" in original:
        print("  ℹ️  Tile declarations already present")
        sys.exit(0)

    patched = patch_content(original)
    if patched == original:
        print("  ❌ Pattern not matched — unexpected manifest format")
        sys.exit(1)

    # Write patched manifest into APPX (rebuild ZIP)
    tmp = appx_path + ".tmp"
    with zipfile.ZipFile(appx_path, "r") as zin:
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_STORED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "AppxManifest.xml":
                    data = patched.encode("utf-8")
                    print(f"  ✓ Patched manifest ({len(original)} → {len(patched)} bytes)")
                zout.writestr(item, data)

    os.replace(tmp, appx_path)

    # Quick verify
    for check in ["Square71x71Logo", "Square310x310Logo"]:
        ok = "✓" if check in patched else "❌"
        print(f"  {ok} {check}")

    print(f"✅ Done: {appx_path}")
