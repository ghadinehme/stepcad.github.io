# StepCAD project page

Project page for **StepCAD: Mesh-to-CAD Code Generation via LLM Policy and Geometry-Guided Search** (NeurIPS 2026),
Ghadi Nehme and Faez Ahmed, MIT.

Live at https://ghadinehme.com/stepcad.github.io/

- `index.html`: the page (static, no build step)
- `static/js/viewer.js`: three.js viewer that replays real StepCAD programs step by step
- `static/models/*.glb` + `examples.json`: per-step meshes, CadQuery code and IoU for eight CADBench runs
- `static/js/main.js`: charts (numbers from the paper's tables) and page interactions

Preview locally with `python3 -m http.server` (the viewer needs HTTP, not `file://`).
