# KEY LENS Production Audit — V23.2 baseline

Audit source: GitHub `main` commit `cccecf3b9210a2d7cde8a3e79ad02355b3d7b4b9`.

| Area | Production finding | V24 decision |
|---|---|---|
| Entry | GitHub Pages participant entry is `key-lens-final.html`. | Keep the same URL and entry file. |
| File role | `key-lens-final.html` owns camera, tracking, MAIN routing, HUD, Operator, and spatial output. | Add HINT modules beside it; no framework migration. |
| Camera init | `camera-init`, `arjs-video-loaded`, `applyCameraFit`, and `stabilizeFit`. | Preserve. |
| AR.js init | A-Frame 1.6 plus local patched AR.js 3.4.8; `trackingMethod:best`. | Preserve. |
| MAIN targets | Five static `a-nft` entities and fifteen dataset files. | Preserve 5/5 and 15/15. |
| MAIN Registry | `NFT_TARGETS` maps target 01–05 to five routes. | Preserve exact mapping. |
| Experiences | `buildRotate`, `buildAnalyze`, `buildActivate`, `buildDecrypt`, `buildAssemble`. | Protect exact source hashes. |
| 3D lifecycle | `KeyLensFX` creates records, camera-space anchors, shared geometry/textures, and per-record disposal. | HINT uses an isolated equivalent lifecycle. |
| FOUND / LOST | Per-marker events call `markerFound` / `markerLost`; LOST grace is 1200 ms. | Bridge HINT without altering MAIN handlers. |
| Operator | `?operator=1` exposes five MAIN triggers and RESET. | Append HINT triggers only in Operator Mode. |
| RESET | Cancels active MAIN token, disposes 3D, hides spatial DOM, and clears completion state. | Append HINT state/timer/object reset; do not restart camera. |
| HUD | `setHud`, status pill, mission row, guide, and bottom message. | Reuse with HINT-specific labels. |
| Assets | MAIN target data is verified by HTTP before scanner start. | HINT pattern failures remain diagnostic and do not block MAIN. |
| Deployment | Static GitHub Pages from repository `main`. | Keep static deployment. |
| Mobile viewport | Samsung-specific Visual Viewport and camera rectangle normalization. | Preserve. HINT DOM reads the same canvas rectangle. |
| MAIN cleanup | Token cancellation plus `disposeRecord` / visibility reset. | Keep untouched and test hashes on every build. |

## HINT attachment point

The lowest-risk attachment point is a sibling tracking and presentation layer:

- AR.js pattern markers are mounted under `#hintMarkerRoot`.
- `hint-registry.js` contains data and copy only.
- `hint-engine.js` owns HINT routing, 3D records, timing, diagnostics, and cleanup.
- `#hintSpatialLayer` is a separate readable companion layer.

Pattern markers avoid adding more NFT workers. Only confirmed nodes are mounted,
and `?round=` can reduce the active set further without exposing a participant
menu.
