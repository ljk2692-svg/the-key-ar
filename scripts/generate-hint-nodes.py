#!/usr/bin/env python3
"""Generate branded AR.js pattern nodes from the HINT registry.

The generated recognition square is deliberately monochrome and asymmetric.
Brand copy and color sit outside the marker boundary so tracking remains stable.
Logical 8x8 modules are expanded to ARToolKit's 16x16 pattern grid so each
feature survives small printing and the 320x240 mobile tracking canvas.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import random
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
GRID = 16
LOGICAL_GRID = 8
MODULE_SCALE = GRID // LOGICAL_GRID
MIN_PATTERN_DISTANCE = 0.32
MIN_BLACK_RATIO = 0.38
MAX_BLACK_RATIO = 0.58
MAX_PATTERN_ATTEMPTS = 10_000
PATTERN_REVISION = "robust-v2"
CARD_W, CARD_H = 1000, 1200
MARKER_SIZE = 720
MARKER_X, MARKER_Y = 140, 196
PATTERN_RATIO = 0.5
INNER_SIZE = int(MARKER_SIZE * PATTERN_RATIO)
BORDER = (MARKER_SIZE - INNER_SIZE) // 2
CELL = INNER_SIZE / GRID


def registry_nodes(path: Path) -> list[dict[str, object]]:
    text = path.read_text(encoding="utf-8")
    pairs = re.findall(
        r'"(H-[A-Z0-9]+)":(complete|scaffold)\(\{\s*id:"\1"[^\n]*?nodeSeed:(\d+)',
        text,
    )
    if not pairs:
        raise SystemExit(f"No HINT nodes found in {path}")
    nodes = [
        {"id": node_id, "seed": int(seed), "tracking": "ACTIVE" if kind == "complete" else "OFF"}
        for node_id, kind, seed in pairs
    ]
    if len({node["id"] for node in nodes}) != len(nodes):
        raise SystemExit("Duplicate HINT node IDs in registry")
    return nodes


def make_pattern(node_id: str, seed: int, salt: int) -> list[list[int]]:
    digest = hashlib.sha256(f"THE-KEY-ROBUST-V2:{node_id}:{seed}:{salt}".encode()).digest()
    rng = random.Random(int.from_bytes(digest[:8], "big"))
    logical = [
        [0 if rng.random() < .43 else 255 for _ in range(LOGICAL_GRID)]
        for _ in range(LOGICAL_GRID)
    ]

    # A restrained, off-centre KEY SYSTEM core keeps the family resemblance
    # without making separate nodes too similar.
    for y, x in [(2, 3), (2, 4), (3, 2), (3, 5), (4, 3), (4, 4), (5, 3), (6, 3)]:
        logical[y][x] = 0

    # Fixed asymmetric anchors make 90-degree rotations unambiguous.
    for y, x in [(0, 0), (0, 1), (1, 0)]:
        logical[y][x] = 0
    for y, x in [(0, 6), (0, 7), (1, 7), (6, 6), (6, 7), (7, 6), (7, 7)]:
        logical[y][x] = 255

    return [
        [logical[y // MODULE_SCALE][x // MODULE_SCALE] for x in range(GRID)]
        for y in range(GRID)
    ]


def rotate(grid: list[list[int]]) -> list[list[int]]:
    return [list(row) for row in zip(*grid[::-1])]


def pattern_distance(a: list[list[int]], b: list[list[int]]) -> float:
    return sum(a[y][x] != b[y][x] for y in range(GRID) for x in range(GRID)) / (GRID * GRID)


def pattern_margin(candidate: list[list[int]], existing: dict[str, list[list[int]]]) -> float:
    distances: list[float] = []
    rotated = candidate
    for _ in range(3):
        rotated = rotate(rotated)
        distances.append(pattern_distance(candidate, rotated))
    for other in existing.values():
        rotated = other
        for _ in range(4):
            distances.append(pattern_distance(candidate, rotated))
            rotated = rotate(rotated)
    return min(distances)


def make_patterns(nodes: list[dict[str, object]]) -> dict[str, list[list[int]]]:
    patterns: dict[str, list[list[int]]] = {}
    for node in nodes:
        node_id, seed = str(node["id"]), int(node["seed"])
        best: tuple[float, int, list[list[int]]] | None = None
        for salt in range(MAX_PATTERN_ATTEMPTS):
            candidate = make_pattern(node_id, seed, salt)
            black_ratio = sum(value == 0 for row in candidate for value in row) / (GRID * GRID)
            if not MIN_BLACK_RATIO <= black_ratio <= MAX_BLACK_RATIO:
                continue
            margin = pattern_margin(candidate, patterns)
            if best is None or margin > best[0]:
                best = (margin, salt, candidate)
            if margin >= MIN_PATTERN_DISTANCE:
                break
        if best is None or best[0] < MIN_PATTERN_DISTANCE:
            raise SystemExit(f"Could not generate robust pattern for {node_id}; best={best}")
        node["patternSalt"] = best[1]
        patterns[node_id] = best[2]
    return patterns


def patt_text(grid: list[list[int]]) -> str:
    blocks: list[str] = []
    oriented = grid
    for _ in range(4):
        for _channel in range(3):
            blocks.extend(" ".join(f"{value:3d}" for value in row) for row in oriented)
        blocks.append("")
        oriented = rotate(oriented)
    return "\n".join(blocks).rstrip() + "\n"


def fonts() -> tuple[ImageFont.FreeTypeFont, ImageFont.FreeTypeFont, ImageFont.FreeTypeFont]:
    bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    mono = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
    return (
        ImageFont.truetype(bold, 34),
        ImageFont.truetype(bold, 58),
        ImageFont.truetype(mono, 34),
    )


def draw_marker(draw: ImageDraw.ImageDraw, grid: list[list[int]], x: int, y: int, size: int) -> None:
    border = int(size * (1 - PATTERN_RATIO) / 2)
    inner = size - border * 2
    cell = inner / GRID
    draw.rectangle((x, y, x + size, y + size), fill=(0, 0, 0))
    for gy, row in enumerate(grid):
        for gx, value in enumerate(row):
            x0 = round(x + border + gx * cell)
            y0 = round(y + border + gy * cell)
            x1 = round(x + border + (gx + 1) * cell)
            y1 = round(y + border + (gy + 1) * cell)
            draw.rectangle((x0, y0, x1, y1), fill=(value, value, value))


def save_png(node_id: str, grid: list[list[int]], out: Path) -> None:
    title_font, id_font, mono_font = fonts()
    image = Image.new("RGB", (CARD_W, CARD_H), (5, 9, 18))
    draw = ImageDraw.Draw(image)
    draw.rectangle((54, 54, CARD_W - 54, CARD_H - 54), outline=(37, 68, 79), width=3)
    draw.text((70, 78), "THE KEY SYSTEM", font=title_font, fill=(215, 182, 109))
    draw.text((70, 127), "HINT NODE / ACCESS PROTOCOL", font=mono_font, fill=(118, 221, 234))
    draw.rectangle((MARKER_X - 28, MARKER_Y - 28, MARKER_X + MARKER_SIZE + 28, MARKER_Y + MARKER_SIZE + 28), fill=(244, 247, 250))
    draw_marker(draw, grid, MARKER_X, MARKER_Y, MARKER_SIZE)
    draw.line((78, 965, 922, 965), fill=(37, 68, 79), width=3)
    bbox = draw.textbbox((0, 0), node_id, font=id_font)
    draw.text(((CARD_W - (bbox[2] - bbox[0])) / 2, 995), node_id, font=id_font, fill=(244, 251, 255))
    draw.text((70, 1080), "SCAN WITH KEY LENS", font=mono_font, fill=(150, 177, 185))
    draw.ellipse((856, 1070, 886, 1100), outline=(118, 221, 234), width=4)
    draw.line((871, 1100, 871, 1136), fill=(215, 182, 109), width=8)
    image.save(out / f"{node_id}.png", optimize=True)

    marker = Image.new("RGB", (MARKER_SIZE + 120, MARKER_SIZE + 120), "white")
    marker_draw = ImageDraw.Draw(marker)
    draw_marker(marker_draw, grid, 60, 60, MARKER_SIZE)
    marker.save(out / f"{node_id}.marker.png", optimize=True)


def save_svg(node_id: str, grid: list[list[int]], out: Path) -> None:
    cells: list[str] = []
    for gy, row in enumerate(grid):
        for gx, value in enumerate(row):
            color = "#000000" if value == 0 else "#ffffff"
            cells.append(
                f'<rect x="{MARKER_X + BORDER + gx * CELL:.3f}" y="{MARKER_Y + BORDER + gy * CELL:.3f}" '
                f'width="{CELL + .2:.3f}" height="{CELL + .2:.3f}" fill="{color}"/>'
            )
    safe_id = html.escape(node_id)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1200" viewBox="0 0 1000 1200">
  <rect width="1000" height="1200" fill="#050912"/>
  <rect x="54" y="54" width="892" height="1092" rx="14" fill="none" stroke="#25444f" stroke-width="3"/>
  <text x="70" y="110" fill="#d7b66d" font-family="Arial,sans-serif" font-size="34" font-weight="800" letter-spacing="5">THE KEY SYSTEM</text>
  <text x="70" y="158" fill="#76ddea" font-family="monospace" font-size="25" font-weight="700" letter-spacing="3">HINT NODE / ACCESS PROTOCOL</text>
  <rect x="112" y="168" width="776" height="776" fill="#f4f7fa"/>
  <rect x="{MARKER_X}" y="{MARKER_Y}" width="{MARKER_SIZE}" height="{MARKER_SIZE}" fill="#000"/>
  {''.join(cells)}
  <line x1="78" y1="965" x2="922" y2="965" stroke="#25444f" stroke-width="3"/>
  <text x="500" y="1052" text-anchor="middle" fill="#f4fbff" font-family="monospace" font-size="58" font-weight="800" letter-spacing="3">{safe_id}</text>
  <text x="70" y="1115" fill="#96b1b9" font-family="monospace" font-size="25" font-weight="700" letter-spacing="3">SCAN WITH KEY LENS</text>
  <circle cx="870" cy="1090" r="16" fill="none" stroke="#76ddea" stroke-width="4"/><path d="M870 1106v32" stroke="#d7b66d" stroke-width="8"/>
</svg>'''
    (out / f"{node_id}.svg").write_text(svg, encoding="utf-8")


def min_rotational_distance(patterns: dict[str, list[list[int]]]) -> float:
    minimum = 1.0
    values = list(patterns.items())
    for i, (_, a) in enumerate(values):
        rotated_a = a
        for _ in range(3):
            rotated_a = rotate(rotated_a)
            minimum = min(minimum, pattern_distance(a, rotated_a))
        for _, b0 in values[i + 1:]:
            b = b0
            for _ in range(4):
                minimum = min(minimum, pattern_distance(a, b))
                b = rotate(b)
    return minimum


def contact_sheet(nodes: list[dict[str, object]], out: Path) -> None:
    active = [node for node in nodes if node["tracking"] == "ACTIVE"]
    pending = [node for node in nodes if node["tracking"] != "ACTIVE"]
    active_cards = "\n".join(
        f'''<article class="nodeCard activeCard" data-node-id="{node["id"]}">
<a href="?node={node["id"]}" aria-label="{node["id"]} 크게 열기"><span class="badge ready">SCAN READY</span><img src="{node["id"]}.png?v={PATTERN_REVISION}" alt="{node["id"]}"><span class="cardAction">크게 열어 스캔</span></a></article>'''
        for node in active
    )
    pending_cards = "\n".join(
        f'''<article class="nodeCard pendingCard" data-node-id="{node["id"]}"><span class="badge pending">TRACKING OFF</span><img src="{node["id"]}.png?v={PATTERN_REVISION}" alt="{node["id"]}"><span class="cardAction">문제 콘텐츠 확정 대기</span></article>'''
        for node in pending
    )
    pending_section = (
        f'''<section><h2>CONTENT PENDING · <span class="count">{len(pending)}</span></h2><p>아래 노드는 Registry와 자산만 준비되었으며 Production 추적은 꺼져 있습니다.</p><div class="grid pendingGrid">{pending_cards}</div></section>'''
        if pending
        else '''<section class="allConfirmed"><h2>CONTENT PENDING · <span class="count">0</span></h2><p>ALL CONTENT CONFIRMED · 모든 HINT NODE가 Production 추적 대상으로 활성화되었습니다.</p></section>'''
    )
    active_ids = json.dumps([node["id"] for node in active], ensure_ascii=False)
    page = f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#050912"><title>THE KEY HINT NODES</title>
<style>
:root{{--bg:#050912;--panel:#07111b;--line:#25444f;--cyan:#76ddea;--gold:#d7b66d;--text:#f4fbff;--muted:#96b1b9}}
*{{box-sizing:border-box}}html,body{{margin:0;min-height:100%;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",Arial,sans-serif}}
header{{max-width:1120px;margin:auto;padding:28px 24px 20px}}.eyebrow{{color:var(--gold);font-size:12px;font-weight:800;letter-spacing:.16em}}h1{{margin:8px 0 6px;font-size:clamp(24px,4vw,40px)}}p{{margin:0;color:var(--muted);line-height:1.55}}main{{max-width:1120px;margin:auto;padding:0 24px 48px}}section{{margin-top:20px}}h2{{font-size:14px;letter-spacing:.13em;color:var(--cyan);margin:0 0 12px}}.count{{color:var(--gold)}}
.grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}}.pendingGrid{{grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}}.nodeCard{{position:relative;padding:12px;border:1px solid var(--line);background:var(--panel);overflow:hidden}}.nodeCard a{{display:block;color:inherit;text-decoration:none}}.nodeCard img{{display:block;width:100%;height:auto}}.badge{{position:absolute;z-index:2;top:20px;right:20px;padding:6px 8px;border-radius:999px;background:rgba(5,9,18,.9);font:800 10px/1 ui-monospace,monospace;letter-spacing:.08em}}.badge.ready{{border:1px solid rgba(118,221,234,.6);color:var(--cyan)}}.badge.pending{{border:1px solid rgba(150,177,185,.35);color:var(--muted)}}.cardAction{{display:block;padding:11px 4px 2px;text-align:center;color:var(--cyan);font-size:12px;font-weight:800;letter-spacing:.05em}}.activeCard a:focus-visible{{outline:2px solid var(--cyan);outline-offset:4px}}.activeCard:hover{{border-color:var(--cyan)}}.pendingCard{{opacity:.42;filter:saturate(.45)}}.pendingCard .cardAction{{color:var(--muted)}}.allConfirmed{{padding:16px;border:1px solid rgba(215,182,109,.28);background:linear-gradient(90deg,rgba(215,182,109,.06),transparent)}}.allConfirmed p{{color:#d9c999;font:750 12px/1.5 ui-monospace,monospace;letter-spacing:.06em}}
#singleView{{display:none;min-height:100vh;padding:12px 18px 28px;place-items:center}}.singleWrap{{width:100%;display:grid;place-items:center;gap:10px}}.singleTop{{width:min(90vw,calc(72vh),720px);display:flex;justify-content:space-between;align-items:center;gap:12px}}.back{{color:var(--cyan);text-decoration:none;font-size:13px;font-weight:800}}.singleStatus{{color:var(--gold);font:800 11px/1 ui-monospace,monospace;letter-spacing:.1em}}#singleImage{{display:block;width:min(90vw,calc(72vh),720px);height:auto;box-shadow:0 24px 80px rgba(0,0,0,.5)}}.singleNote{{color:var(--muted);font-size:12px;text-align:center}}body.singleMode>header,body.singleMode>main{{display:none}}body.singleMode #singleView{{display:grid}}
@media(max-width:720px){{.grid{{grid-template-columns:1fr}}header{{padding:22px 16px 14px}}main{{padding:0 16px 32px}}.pendingGrid{{grid-template-columns:repeat(2,minmax(0,1fr))}}.badge{{top:16px;right:16px}}}}
</style></head><body>
<header><div class="eyebrow">THE KEY SYSTEM / HINT NODE MASTER</div><h1>HINT NODE 스캔 보드</h1><p>SCAN READY 카드를 눌러 한 장만 크게 연 뒤 KEY LENS로 비추십시오.</p></header>
<main>
<section><h2>PRODUCTION ACTIVE · <span class="count">{len(active)}</span></h2><div class="grid">{active_cards}</div></section>
{pending_section}
</main>
<div id="singleView" aria-live="polite"><div class="singleWrap"><div class="singleTop"><a class="back" href="./">← 전체 보기</a><span class="singleStatus">SCAN READY</span></div><img id="singleImage" alt=""><div class="singleNote">화면 밝기를 높이고 카드 전체가 카메라에 보이게 하십시오.</div></div></div>
<script>
(()=>{{const activeIds=new Set({active_ids});const id=new URLSearchParams(location.search).get("node");if(!activeIds.has(id))return;document.body.classList.add("singleMode");const image=document.querySelector("#singleImage");image.src=`${{id}}.png?v={PATTERN_REVISION}`;image.alt=id;document.title=`${{id}} · THE KEY HINT NODE`;}})();
</script></body></html>'''
    (out / "index.html").write_text(page, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", type=Path, default=ROOT / "hint-registry.js")
    parser.add_argument("--out", type=Path, default=ROOT / "hint-nodes")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    nodes = registry_nodes(args.registry)
    patterns = make_patterns(nodes)
    distance = min_rotational_distance(patterns)
    if distance < MIN_PATTERN_DISTANCE:
        raise SystemExit(f"Pattern separation too low: {distance:.3f}")
    for node in nodes:
        node_id = str(node["id"])
        grid = patterns[node_id]
        (args.out / f"{node_id}.patt").write_text(patt_text(grid), encoding="utf-8")
        save_png(node_id, grid, args.out)
        save_svg(node_id, grid, args.out)
    contact_sheet(nodes, args.out)
    manifest = {
        "schemaVersion": 2,
        "generator": "scripts/generate-hint-nodes.py",
        "patternRatio": PATTERN_RATIO,
        "grid": GRID,
        "logicalGrid": LOGICAL_GRID,
        "moduleScale": MODULE_SCALE,
        "recognitionRevision": "ROBUST-V2",
        "nodeCount": len(nodes),
        "activeNodeCount": sum(node["tracking"] == "ACTIVE" for node in nodes),
        "minimumRotationalHammingDistance": round(distance, 4),
        "nodes": nodes,
    }
    (args.out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(nodes)} HINT NODE sets; min rotational distance={distance:.4f}")


if __name__ == "__main__":
    main()
