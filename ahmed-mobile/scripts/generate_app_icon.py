from pathlib import Path
import shutil
import struct


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SOURCE = ASSETS / "approved-app-icon.png"
TARGETS = (
    ASSETS / "icon.png",
    ASSETS / "adaptive-icon.png",
    ASSETS / "splash-icon.png",
    ASSETS / "favicon.png",
)


def inspect_png(path: Path) -> tuple[int, int]:
    with path.open("rb") as image:
        header = image.read(26)

    if header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise RuntimeError(f"{path} is not a valid PNG")

    width, height = struct.unpack(">II", header[16:24])
    bit_depth = header[24]
    color_type = header[25]
    if width != height or width < 1024:
        raise RuntimeError(f"{path} must be a square PNG of at least 1024px")
    if bit_depth != 8 or color_type != 2:
        raise RuntimeError(f"{path} must be an opaque 8-bit RGB PNG")
    return width, height


ASSETS.mkdir(parents=True, exist_ok=True)
dimensions = inspect_png(SOURCE)

for target in TARGETS:
    if target != SOURCE:
        shutil.copyfile(SOURCE, target)
    if inspect_png(target) != dimensions:
        raise RuntimeError(f"{target} does not match the approved app icon")
    print(f"Approved Ahmed icon ready: {target} {dimensions[0]}x{dimensions[1]} RGB")
