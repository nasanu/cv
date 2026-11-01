# fn-lambo

`<fn-lambo>`, a retrowave scene as a single web component, and `lambo.html`, which shows it full screen.

No dependencies and no build step: open `lambo.html` (or serve the folder, which the skyline equaliser needs).

- `lib/lambo.js`: the component
- `lambo.html`: the full screen page
- images and `music/`: the assets `lambo.js` and `lambo.html` use, beside the page because their paths are relative to it
- `scripts/bundle-lambo.ps1`: builds `fn-lambo.zip` (the component, its assets, a demo page and the docs from
  `scripts/lambo-bundle/`). Run it by hand; nothing builds it automatically.

The other Fn web components now live in their own repo.
