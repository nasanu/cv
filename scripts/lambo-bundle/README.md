# rex-lambo

A retrowave scene as a single web component: a pixel art Lamborghini Countach with spinning wheels, on a neon highway
beside a wireframe skyline, a big moon and twinkling stars. On the INSERT COIN screen the car waits stopped on an empty road (it cruises there in vibe mode), with no billboards, until Enter, Space or a tap, drives to a
roadside billboard, stops, and shows a text panel for it. The next press or tap drives on to the next billboard.

No dependencies, no build step. It is one JavaScript file plus a few images.

## What is in this folder

| File                    | What it is                                                            |
| ----------------------- | --------------------------------------------------------------------- |
| `lambo.js`              | The component (`<rex-lambo>`). Defines the custom element when loaded |
| `index.html`            | A minimal demo page showing how to use it                             |
{{ASSETS}}

Image paths are relative (`./name.jpg`), so they are resolved against the page that uses the component, not against
`lambo.js`. Keep the images beside your HTML page (or change the paths, see below). This also lets the demo work under a
sub path such as GitHub Pages.

## Use it

```html
<rex-lambo src="./lambo-transparent.png" avatar="./me.jpg" speed="0.2"></rex-lambo>
<script src="./lambo.js"></script>
```

It is also fine as a module (`<script type="module" src="./lambo.js">`) or imported from a bundler
(`import "./lambo.js"`). The element is `display: block` and fills its container's width, at a 16:10 shape (minimum
height 28rem). `--borderRadius` sets the corner radius.

### Attributes

| Attribute | Default                  | Meaning                                                                    |
| --------- | ------------------------ | -------------------------------------------------------------------------- |
| `src`     | `./lambo-transparent.png` | The car image. Wheels are drawn over it, so a different car needs new wheel positions (`RexLambo.wheels`) |
| `avatar`  | `./me.jpg`               | The photo on the profile billboard. Read when the component connects       |
| `speed`   | `0.2`                    | Seconds per wheel revolution. Smaller is faster. Everything moves in step  |
| `paused`  | (absent)                 | Freezes the wheels, road and billboards while present                      |
| `fill`   | (absent)                 | Runs full screen, not in a box: the component fills the box it is given (`position: fixed; inset: 0` for the whole window), with square corners. The layout is never wider than 1.6 times its height, so on a wider window it is centred and the sky, road and skyline carry on past its sides. The demo `index.html` uses this |

### Controls

- VIBE MODE (top right, always shown): a neon switch. Switching it on, from any screen, sends the car back to the INSERT COIN screen
  and turns the music and the skyline equaliser on, with no text panels. Any press, key or swipe then switches it off and carries on as
  normal (driving to the first billboard). Switching it off with the switch itself stops the music.
- Volume: hover over the sound switch (or tab to it, or tap it on a touch screen) for a slider under it. It starts at 30%;
  turning it up while the music is switched off switches it on.
- Escape, or the back button (on a phone, or the browser's), goes from start mode back to the INSERT COIN screen. (Setting off from
  that screen adds a step to the page's history for the back button to undo.)
- Keyboard: the component can be tabbed to. Enter, Space or the left arrow drives to the next billboard (like a swipe right) and the right arrow goes back
  (not a key held down, and not Ctrl, Cmd, Alt or Shift shortcuts). Letter keys do nothing. The keys work while the component has the focus, and
  on a `fill` one from anywhere on the page, but never while typing in a field or on a button or link. While the text panel has the focus,
  the keys scroll it. A tap or click on the component also starts the car.
- Accessibility: the component has a name and instructions for screen readers, and announces each stop (`Stopped at ME. Tab to read the details...`).
  With reduced motion set, nothing animates: the car goes straight to the next billboard. The `INSERT COIN` prompt blinks until the first press (not at all with reduced motion).
- Swipe right (or drag, with a mouse) to drive to the next billboard, and swipe left to drive round to the previous one,
  straight past the others. A tap or click anywhere on the scene is the same as a swipe right. A press on the text panel
  never counts as a tap, but a finger swipe along it still counts.
- Once the car has set off, a progress strip at the bottom left shows the car on a road from START (right) to a FINISH line (left), with a mini billboard for each
  entry in `tables`. Driving past the last billboard crosses the finish line and the car starts a new lap.
  Click (or Tab to and press Enter on) a mini billboard to drive straight to that stop, past any billboards in between; a stop
  behind the car is reached by going on round over the finish line.
- A TURBO switch at the top left (shown once the car has set off) makes the car drive at twice the speed while it is on.
- While the car drives and the music plays, the windows in the buildings act as a graphic equaliser: each building lights up
  from the ground to the height of its slice of the music's spectrum (low notes on the left of the screen, high on the right).
  The buildings have no lights otherwise, except with the sound switched off (the speaker button), when a few windows flip on\n  and off at random. It needs the page to be served over http(s) from the same site as the music
  (a page opened straight from disk plays the music, but the buildings stay dark).
- Clicking an image or video in a text panel opens it in an almost full screen popup. Escape, the close button or a click
  outside the media closes it.

## Changing the content

Everything shown at each stop lives in the static array `RexLambo.tables` at the top of `lambo.js`. There is one entry
per billboard, and the billboards go round the entries in order:

```js
{
  title: "THE HUMAN",
  scores: [["CYCL", "64000"], ["YT", "29339"], ["TVL", "10220"]], // three [name, score] pairs
  text: ["First paragraph (may contain HTML).", "Second paragraph."],
  media: [                       // optional
    { type: "image", file: "./himawariCut.jpg", subtitle: "Caption under it" }, // type: image (default), video or audio
  ],
  links: [                       // optional
    { text: "Resume", type: "download", file: "./resume.pdf" },          // type: download (down arrow, the default)
    { text: "My channel", type: "youtube", file: "https://youtube.com/@name" }, // type: youtube (logo)
  ],
}
```

- `\n` inside a paragraph is a line break.
- The panel scrolls when the content is longer than the space.
- A download link to a file on the same site downloads it. A link to another site (or a youtube link) opens in a new tab.
- Media and links are laid out in a grid of equal size thumbnails and buttons.

The pixel art on each billboard is drawn in code in the static array `RexLambo.arts` (a 64 x 32 canvas each). Entry `n`
of `arts` goes with entry `n` of `tables`. If there are more tables than arts, the arts are reused.

## Notes

- Works in current Chrome, Edge, Firefox and Safari. It uses custom elements, shadow DOM, CSS container query units
  (`cqw`), `<dialog>` and `:has()`.
- It respects `prefers-reduced-motion` for the CSS animations and the star twinkle.
- The star twinkle and the window lights stop while the component is scrolled off screen.

## Credits

The soundtrack (in `music/`) is licensed CC BY-SA 3.0, so keep this credit if you use it:

- Timbral - Speed of Time (https://soundcloud.com/timbral/speed-of-time)
