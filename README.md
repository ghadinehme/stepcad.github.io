# StepCAD project page

Project page for **StepCAD: Mesh-to-CAD Code Generation via LLM Policy and Geometry-Guided Search**
([arXiv:2610.03799](https://arxiv.org/abs/2610.03799)), Ghadi Nehme and Faez Ahmed, MIT.

Live at https://ghadinehme.com/stepcad.github.io/

- `index.html`: the page (static, no build step), built on the [Nerfies](https://nerfies.github.io) template.
- `static/js/viewer.js`: three.js replay of a StepCAD run (policy steps, then search edits) in the method section;
  geometry in `static/models/bracket.glb` + `examples.json`.
- `static/js/gal.js`: reconstruction gallery. Each `static/models/gNN.glb` holds a CADBench input mesh (`input`) and the
  executed StepCAD-3.5M program (`cad`); `gallery.json` has the split and the official CADBench IoU.
- `static/js/three/`: three.js r160 (MIT), vendored so the viewer does not depend on a CDN.
- `static/img/`: the teaser, the method figure and the gallery thumbnails.

Bump the `?v=` tag in `index.html`, `viewer.js` and `gal.js` after changing assets, so browsers never mix old and new files.

Preview locally with `python3 -m http.server` (the viewer needs HTTP, not `file://`).
