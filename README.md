# THE KEY SYSTEM / KEY LENS

Production WebAR scanner for THE KEY SYSTEM. The deployed participant entry is
[`key-lens-final.html`](./key-lens-final.html); GitHub Pages serves it at
`https://ljk2692-svg.github.io/the-key-ar/key-lens-final.html`.

## Runtime architecture

- MAIN EXPERIENCE: five existing AR.js NFT targets route to AR01 ROTATE, AR02
  ANALYZE, AR03 ACTIVATE, AR04 DECRYPT, and AR05 ASSEMBLE.
- HINT PROTOCOL: lightweight AR.js pattern nodes route through the data-driven
  registry in `hint-registry.js` and the reusable Three.js engine in
  `hint-engine.js`.
- Tracking load: the five NFT workers remain unchanged. Only confirmed HINT
  nodes are mounted; scaffold nodes are not loaded by the participant runtime.
- Presentation: Three.js geometry provides the spatial hologram while the
  companion DOM layer keeps short Korean copy readable on portrait phones.
- Deployment: `key-lens-final.html` embeds the HINT CSS, Registry snapshot,
  engine, and fourteen active patterns so Production can be updated atomically with
  one file. The separate modules remain the maintainable source of truth.

V24.4 mounts all fourteen confirmed nodes: four ROUND 1 nodes, one ROUND 2
node, and the ROUND 3 guide plus all eight ROUND 3 mission nodes. Every node is
Registry-routed and has a source-grounded HINT 1/HINT 2 copy pair. The default
`ALL` group mounts fourteen lightweight pattern markers; event links may use
the round filter to mount only the current round's 4, 1, or 9 nodes.

## Internal configuration

These query parameters are for operations and QA, not participant selection:

- `?operator=1` — MAIN and HINT scene controls plus diagnostics
- `?diag=1` — tracker/HINT diagnostics
- `?round=1`, `?round=2`, `?round=3`, or `?round=ALL` — mounted HINT group
- `?audience=SCHOOL` or `?audience=CORPORATE` — copy variant
- `?eventMode=FAST_120`, `STANDARD_150`, or `STRATEGY_180` — HINT 2 timing

## Node generation and verification

```bash
python3 scripts/generate-hint-nodes.py
python3 scripts/verify-hint-node-pairing.py
node scripts/build-standalone.mjs
node scripts/verify-key-lens.mjs
node scripts/test-hint-runtime.mjs
```

The generator creates `.patt`, print PNG, SVG, and marker-only PNG assets from
each Registry ID and seed. `qa/content-master.json` is the answer-free public
QA index. The canonical answer master is retained outside this public
repository and must never be loaded by participant HTML or JavaScript.

## Production constraints

- Keep the A-Frame/AR.js camera and Samsung viewport paths intact.
- Do not replace the five NFT target datasets in `target-nft/`.
- Do not expose canonical answers in participant code or HINT copy.
- A successful Operator test does not replace printed-node tracking tests on
  Samsung Internet and Android Chrome.
