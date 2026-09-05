#!/usr/bin/env python3
"""Verify every rendered HINT card resolves to its own AR.js pattern only.

This is intentionally independent from the generator's in-memory grids: it
reads the committed PNG pixels and `.patt` files back from disk, then compares
all IDs and all four rotations. A mobile-size resample catches layout or export
changes that preserve the source grid but damage the actual scan asset.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
NODE_DIR = ROOT / "hint-nodes"
GRID = 16
CARD_BOX = (140, 196, 720)
MARKER_BOX = (60, 60, 720)
PATTERN_RATIO = 0.5
MIN_RUNNER_UP_DISTANCE = 0.32


def rotate(grid: list[list[int]]) -> list[list[int]]:
    return [list(row) for row in zip(*grid[::-1])]


def distance(a: list[list[int]], b: list[list[int]]) -> float:
    return sum(a[y][x] != b[y][x] for y in range(GRID) for x in range(GRID)) / (GRID * GRID)


def read_pattern(path: Path) -> list[list[int]]:
    values = [int(value) for value in path.read_text(encoding="utf-8").split()]
    if len(values) != GRID * GRID * 12:
        raise ValueError(f"{path.name}: expected 3072 values, found {len(values)}")
    return [values[row * GRID : (row + 1) * GRID] for row in range(GRID)]


def sample_grid(image: Image.Image, marker_box: tuple[int, int, int]) -> list[list[int]]:
    gray = image.convert("L")
    x, y, size = marker_box
    border = size * (1 - PATTERN_RATIO) / 2
    inner = size * PATTERN_RATIO
    cell = inner / GRID
    samples = [
        gray.getpixel((round(x + border + (gx + .5) * cell), round(y + border + (gy + .5) * cell)))
        for gy in range(GRID)
        for gx in range(GRID)
    ]
    threshold = (min(samples) + max(samples)) / 2
    return [
        [255 if samples[gy * GRID + gx] > threshold else 0 for gx in range(GRID)]
        for gy in range(GRID)
    ]


def scaled_variant(image: Image.Image, marker_box: tuple[int, int, int], width: int) -> tuple[Image.Image, tuple[int, int, int]]:
    scale = width / image.width
    resized = image.resize((width, round(image.height * scale)), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(.35))
    x, y, size = marker_box
    return resized, (round(x * scale), round(y * scale), round(size * scale))


def best_matches(source: list[list[int]], patterns: dict[str, list[list[int]]]) -> list[tuple[float, str, int]]:
    matches: list[tuple[float, str, int]] = []
    for node_id, pattern in patterns.items():
        oriented = pattern
        for rotation in range(4):
            matches.append((distance(source, oriented), node_id, rotation * 90))
            oriented = rotate(oriented)
    return sorted(matches)


def verify_variant(node_id: str, label: str, image: Image.Image, marker_box: tuple[int, int, int], patterns: dict[str, list[list[int]]]) -> None:
    sampled = sample_grid(image, marker_box)
    matches = best_matches(sampled, patterns)
    winner = matches[0]
    runner_up = next(match for match in matches[1:] if match[1] != node_id or match[2] != winner[2])
    if winner[0] != 0 or winner[1] != node_id:
        raise AssertionError(f"{node_id} {label}: winner={winner}")
    if runner_up[0] < MIN_RUNNER_UP_DISTANCE:
        raise AssertionError(f"{node_id} {label}: runner-up margin={runner_up[0]:.4f} ({runner_up[1]} @ {runner_up[2]}°)")
    print(f"PASS  {node_id} {label} → {winner[1]} @ {winner[2]}° · margin {runner_up[0]:.4f}")


def main() -> None:
    manifest = json.loads((NODE_DIR / "manifest.json").read_text(encoding="utf-8"))
    node_ids = [node["id"] for node in manifest["nodes"]]
    patterns = {node_id: read_pattern(NODE_DIR / f"{node_id}.patt") for node_id in node_ids}
    if manifest["activeNodeCount"] != len(node_ids):
        raise AssertionError(f"Only {manifest['activeNodeCount']}/{len(node_ids)} nodes are active")

    for node_id in node_ids:
        card = Image.open(NODE_DIR / f"{node_id}.png")
        marker = Image.open(NODE_DIR / f"{node_id}.marker.png")
        verify_variant(node_id, "PRINT", card, CARD_BOX, patterns)
        small_card, small_card_box = scaled_variant(card, CARD_BOX, 320)
        verify_variant(node_id, "MOBILE-320", small_card, small_card_box, patterns)
        small_marker, small_marker_box = scaled_variant(marker, MARKER_BOX, 280)
        verify_variant(node_id, "MARKER-280", small_marker, small_marker_box, patterns)

    print(f"\nPAIRING PASS: {len(node_ids)}/14 nodes · 42 rendered-image checks")


if __name__ == "__main__":
    main()
