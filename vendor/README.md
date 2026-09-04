# KEY LENS AR.js NFT runtime

`aframe-ar-nft-3.4.8-keylens.js` is the official AR.js 3.4.8 A-Frame NFT
build with one narrowly scoped compatibility patch for KEY LENS's five-image
tracking setup.

- Upstream project: https://github.com/AR-js-org/AR.js
- Upstream release: 3.4.8
- Upstream file SHA-256:
  `a5536018932307a7b8e4fd21e774c48f8d1f3ca3371b12cc07f12b7e7f0acb18`
- Local file SHA-256:
  `a69d328502e0213b8822a287bdb33d10138945c0558e1e6b3636ecebe9095d2d`
- License: MIT (same as the upstream AR.js project)

The upstream build stores NFT visibility in the shared
`arController.showObject` boolean. With multiple NFT workers, a worker that
does not see its own target can therefore hide a different worker's detected
target. The local patch stores that boolean on each marker control instead.
No camera, pose, descriptor loading, A-Frame, or rendering behavior is changed.

This corresponds to the upstream multi-NFT issue:
https://github.com/AR-js-org/AR.js/issues/132
