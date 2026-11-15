#!/usr/bin/env python3
"""Shadowline terrain preprocessing.

Reads ONE NASA PGDA LOLA 5 m/pixel south-pole site tile (GeoTIFF), block-averages
it to a browser-friendly resolution, and writes:

    public/terrain/<site>.bin   float32, little-endian, row-major, row 0 = top (max Y)
    public/terrain/<site>.json  metadata (size, resolution, bounds, CRS, source, stats)

Source data: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/  (product 78)
Reference: Barker et al. (2021), Planet. Space Sci. 203, 105119,
           https://doi.org/10.1016/j.pss.2020.105119

Usage (from the project root):
    pip install numpy rasterio
    python3 preprocess/terrain.py                  # Site04, 8x -> 40 m/px
    python3 preprocess/terrain.py --site Site01 --factor 6

The script refuses any download over 200 MB so the 3.3 GB polar mosaic can never
be pulled by accident.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from datetime import date
from pathlib import Path

import numpy as np
import rasterio

BASE_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp"
MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024
SITE_NAMES = {
    "Site01": "Connecting ridge",
    "Site04": "Shackleton rim",
    "Site07": "Peak near Shackleton",
    "Site11": "de Gerlache rim",
    "Site20": "Leibnitz beta plateau",
    "Site23": "Malapert massif",
}
ROOT = Path(__file__).resolve().parent.parent


def tile_url(site: str) -> str:
    return f"{BASE_URL}/{site}/{site}_final_adj_5mpp_surf.tif"


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    head = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(head, timeout=60) as r:
        size = int(r.headers.get("Content-Length", "0"))
    if size == 0 or size > MAX_DOWNLOAD_BYTES:
        sys.exit(f"Refusing download: {url} reports {size} bytes (limit {MAX_DOWNLOAD_BYTES}).")
    print(f"Downloading {url} ({size / 1e6:.1f} MB)")
    with urllib.request.urlopen(url, timeout=600) as r, open(dest, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    if dest.stat().st_size != size:
        dest.unlink()
        sys.exit("Download incomplete; removed partial file. Re-run.")


def block_mean(z: np.ndarray, factor: int) -> np.ndarray:
    """Average factor x factor blocks, ignoring NaN. Crops ragged edges."""
    h = (z.shape[0] // factor) * factor
    w = (z.shape[1] // factor) * factor
    blocks = z[:h, :w].reshape(h // factor, factor, w // factor, factor)
    with np.errstate(invalid="ignore"):
        return np.nanmean(blocks, axis=(1, 3))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", default="Site04", choices=sorted(SITE_NAMES))
    ap.add_argument("--factor", type=int, default=8, help="integer downsample factor (4-10 gives 20-50 m/px)")
    ap.add_argument("--input", type=Path, help="existing GeoTIFF (skips download)")
    ap.add_argument("--out", type=Path, default=ROOT / "public" / "terrain")
    args = ap.parse_args()
    if not 4 <= args.factor <= 10:
        sys.exit("--factor must be 4..10 (20-50 m/px).")

    url = tile_url(args.site)
    src_path = args.input or ROOT / "preprocess" / "raw" / Path(url).name
    if not src_path.exists():
        download(url, src_path)

    with rasterio.open(src_path) as ds:
        z = ds.read(1).astype(np.float64)
        t = ds.transform
        nodata = ds.nodata
        crs = ds.crs.to_wkt() if ds.crs else None
        if abs(t.b) > 1e-9 or abs(t.d) > 1e-9 or t.e >= 0:
            sys.exit("Expected a north-up, unrotated raster.")
        px = float(t.a)
        if abs(px + t.e) > 1e-6:
            sys.exit("Expected square pixels.")
        left, top = float(t.c), float(t.f)
        native_shape = z.shape

    if nodata is not None:
        z[z == nodata] = np.nan
    n_nodata = int(np.isnan(z).sum())

    out = block_mean(z, args.factor)
    if np.isnan(out).any():
        sys.exit("Downsampled grid still contains no-data cells; choose another tile/factor.")
    res = px * args.factor
    h, w = out.shape

    args.out.mkdir(parents=True, exist_ok=True)
    site = args.site.lower()
    out.astype("<f4").tofile(args.out / f"{site}.bin")
    meta = {
        "site": args.site,
        "name": SITE_NAMES[args.site],
        "width": w,
        "height": h,
        "resolution_m": res,
        "units": "meters",
        "elevation_reference": "surface height Z in meters (as stated on the PGDA LOLA_5mpp data page); datum not independently verified",
        "elevation_min_m": float(out.min()),
        "elevation_max_m": float(out.max()),
        "bounds_polar_stereo_m": {"left": left, "top": top, "right": left + w * res, "bottom": top - h * res},
        "row_order": "row 0 = top (max Y); column 0 = left (min X)",
        "dtype": "float32 little-endian",
        "crs_wkt": crs,
        "source_url": url,
        "source_citation": "Barker et al. (2021), Planet. Space Sci. 203, 105119, doi:10.1016/j.pss.2020.105119",
        "native_resolution_m": px,
        "native_shape": list(native_shape),
        "native_nodata_pixels": n_nodata,
        "downsample_factor": args.factor,
        "downsample_method": "block mean",
        "processed": date.today().isoformat(),
    }
    (args.out / f"{site}.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(json.dumps({k: v for k, v in meta.items() if k != "crs_wkt"}, indent=2))


if __name__ == "__main__":
    main()
