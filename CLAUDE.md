# Notes for Claude

## Code files in `public/` are copies, not the source

Do not edit code files (`.js`, etc.) in `public/`. They are copies, and edits made there are overwritten and are not used by the site's pages.

- `public/lib/` is deleted and re-copied from `src/components/lib/` on every build (`scripts/move.ps1`, run by `postbuild`).
- The site's pages (for example `src/components/pages/lamboTest.astro`) and the `rex-lambo.zip` bundle (`scripts/bundle-lambo.ps1`) use the files in `src/components/lib/`.
- Always make edits in the original file, usually under `src/components/`. Find it before editing, and if unsure, check how the file is produced (`scripts/`).
- Static assets in `public/` (images, svg, music) are the real files, not copies.

If a change to a `public/` copy is needed for it to show up right away, make it in the original and then copy it across, so the two never differ.
