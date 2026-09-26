# StepCAD project page

Project page for **StepCAD: Mesh-to-CAD Code Generation via LLM Policy and Geometry-Guided Search** (NeurIPS 2026),
Ghadi Nehme and Faez Ahmed, MIT.

Live at https://ghadinehme.com/stepcad.github.io/

- `index.html`: the page (static, no build step)
Built on the [Nerfies](https://nerfies.github.io) template, like the VideoCAD, CADFit and LAMP pages.

- `static/js/viewer.js`: three.js replay of real StepCAD runs. Stage I executes the policy's program one
  operation at a time; Stage II applies the search edits (policy program -> refined program) one at a time
  and highlights the material each edit adds or removes.
- `static/models/*.glb` + `examples.json`: per-step meshes, CadQuery code and IoU for seven CADBench runs
- `static/js/main.js`: More Works dropdown, charts (numbers from the paper's tables) and page interactions
- `static/css/stepcad.css`: additions on top of the template's `index.css`

Preview locally with `python3 -m http.server` (the viewer needs HTTP, not `file://`).
