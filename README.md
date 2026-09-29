# StepCAD project page

Project page for **StepCAD: Mesh-to-CAD Code Generation via LLM Policy and Geometry-Guided Search** (NeurIPS 2026),
Ghadi Nehme and Faez Ahmed, MIT.

Live at https://ghadinehme.com/stepcad.github.io/

- `index.html`: the page (static, no build step)
Built on the [Nerfies](https://nerfies.github.io) template, like the VideoCAD, CADFit and LAMP pages.
No figures are taken from the paper: every image is a Blender render of real geometry (CADBench inputs,
StepCAD outputs, ARCADE programs replayed step by step), and every chart is drawn from the paper's tables.

- `static/js/viewer.js`: three.js replay of real StepCAD runs (policy steps, then search edits with the
  material each edit adds or removes)
- `static/js/sections.js`: method loop diagram, the real beam-search trace, ARCADE trajectory scrubber,
  operation tiles and reconstruction gallery
- `static/js/main.js`: More Works dropdown, dataset/result charts, ablation
- `static/models/`: `*.glb` + `examples.json` (replay), `search_trace.json` (beam-search log of the stepped
  pin), `sections.json` (ARCADE programs, gallery IoUs)
- `static/img/`: renders (`method/`, `arcade/`, `arcade_traj/`, `ops/`, `gallery/`)

Bump the `?v=` tag in `index.html` and the JS files after changing assets, so browsers never mix old and new files.

Preview locally with `python3 -m http.server` (the viewer needs HTTP, not `file://`).
