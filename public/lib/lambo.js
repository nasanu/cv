/*
 * <rex-lambo> - a pixel art Lamborghini Countach with spinning wheels.
 *
 * The car is an image (default ./lambo-transparent.png). The wheels are CSS/HTML discs laid over the
 * painted wheels, squashed and tilted to match the perspective, and spun with a CSS animation.
 *
 * attributes
 *   src    - image url (default "./lambo-transparent.png")
 *   speed  - seconds per wheel revolution (default 0.2, smaller is faster)
 *   avatar - image for the character profile billboard (default "./me.jpg")
 *   paused - freezes the wheels, the road and the billboards
 *   (the car waits stopped on the INSERT COIN screen (it cruises there in vibe mode) until Enter, Space, the left arrow or a touch, then drives to a billboard, stops, and goes on at the next press;
 *   the right arrow or a swipe left goes back. It is focusable, and a live region announces each stop)
 */
class RexLambo extends HTMLElement {
  static observedAttributes = ["src", "speed", "paused"];

  static defaultSrc = "./lambo-transparent.png";
  // the soundtrack: played in a random order (a single track just loops), from the first key press or tap (browsers don't allow sound before one)
  static music = ["./music/speed-of-time.mp3"];
  // How loud, as a share of full loudness. The browser's audio.volume is a plain amplitude scale, which sounds much louder
  // than its number (0.3 is only about 10 dB down, and these tracks are mastered loud), so it is turned into amplitude the
  // way hearing works: twice as loud is 10 dB more, so 30% loudness is about 17 dB down (amplitude 0.135) and 60% about
  // 7 dB down (amplitude 0.43).
  static musicDelay = 1; // seconds of quiet before a track starts
  static musicVolume = 0.6;
  static musicAmplitude = 10 ** ((10 * Math.log2(RexLambo.musicVolume)) / 20);
  static defaultSpeed = 0.2; // seconds per wheel revolution
  static attractSpeed = 1; // how fast the car cruises in vibe mode, as a share of full speed (and then doubled, like TURBO)
  static label = "Interactive scene of a Lamborghini Countach. Press Enter, Space or the left arrow to drive to the next billboard, and the right arrow to go back.";
  // The barrier is built from this many pieces end to end, each barrierBlocks road blocks long (see .barrier), shifted by --off so
  // that the barrier's own 48cqw patterns join up seamlessly. As one 44 block strip it was wider than the largest
  // texture a GPU will draw (16384px) on a big window (about 1800px wide and up), and then the barrier vanished.
  static barrierPieces = 16;
  static barrierBlocks = 3; // so each piece is 3 blocks long: that is under 16384px up to a window about 7000px wide (a 4K screen is 3840)
  static roadTiles = 20; // the road is this many tiles of 3 blocks end to end (60 blocks), for the same reason
  static roadTileBlocks = 3;
  static motionCount = 2 + RexLambo.roadTiles + 3 * RexLambo.barrierPieces; // CSS animations that are slowed with the car: two wheels, a road tile each, and a barrier, its lid and rail for each piece
  static roadPerSpin = 2.3; // one block of road is roughly 2.3 wheel turns long, so the road keeps pace with the wheels

  /** Seconds per wheel revolution, from the speed attribute. */
  get speed() {
    return parseFloat(this.getAttribute("speed")) || RexLambo.defaultSpeed;
  }

  // wheel placement as % of the image (1408 x 768), plus perspective squash + tilt
  static wheels = [
    { name: "front", x: 55.2, y: 79.2, h: 22.4, k: 0.7, tilt: 6 },
    { name: "rear", x: 89.4, y: 60.4, h: 18.6, k: 0.5, tilt: 10 },
  ];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    // it can be tabbed to, and says what it is and which keys drive it (see onKey); an author's own attributes win
    if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
    if (!this.hasAttribute("role")) this.setAttribute("role", "group");
    if (!this.hasAttribute("aria-label")) this.setAttribute("aria-label", RexLambo.label);
    this.driving = false; // false while parked (or not yet started), true from a key press until the car stops
    this.speedNow = 0; // 0 = parked, 1 = full speed
    this.boards = [];
    this.cityBlocks = 0;
    this.billboardCount = 0;
    this.audio = null; // the soundtrack's player, made on the first drive
    this.audioCtx = null;
    this.analyser = null;
    this.musicOn = true; // the sound switch
    this.turbo = false; // the TURBO switch: double speed while on
    this.vibe = false; // the VIBE MODE switch: the music and the equaliser on, and no text panels (see setVibe)
    this.vibeBefore = null; // what the music was doing before vibe mode, to put back when it is switched off
    this.boost = 1; // the speed multiplier right now, easing between 1 and 2 as the switch is flipped
    this.here = -1; // the table entry the car is at (or heading for): -1 is the start line
    this.journey = null; // the drive in progress, or the last one: see driveTo
    this.last = 0;
    this.frame = 0;
    this.rate = 0; // the playbackRate the CSS animations are at
    this.onScreen = true;
    this.avatarSrc = this.getAttribute("avatar") || RexLambo.avatarSrc; // per component, so two can have different photos

    // the wheels and the road are CSS animations; their playbackRate is how fast the car is going
    const stage = this.shadowRoot.querySelector(".stage");
    this.collectMotion();

    const track = stage.querySelector(".track");
    this.trackEls = {
      me: track.querySelector(".me"),
      finish: track.querySelector(".finish"),
      stops: [...track.querySelectorAll(".stop")],
    };
    this.trackKey = "";
    this.lapFlashed = false;
    // a click on a mini billboard drives straight there; touches on the strip must not also set the car off
    track.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.trackEls.stops.forEach((el, i) =>
      el.addEventListener("click", () => this.goTo(i)),
    );
    // the TURBO switch (shown once the car has set off): doubles the speed of everything while it is on
    const turbo = stage.querySelector(".turbo");
    turbo.addEventListener("pointerdown", (e) => e.stopPropagation());
    turbo.addEventListener("click", () => {
      this.turbo = !this.turbo;
      turbo.setAttribute("aria-checked", this.turbo);
    });
    // the VIBE MODE switch (top right, on the INSERT COIN screen): music and equaliser on, text panels off
    const vibe = stage.querySelector(".vibe");
    vibe.addEventListener("pointerdown", (e) => e.stopPropagation());
    vibe.addEventListener("click", () => this.setVibe(!this.vibe));
    // the sound switch beside it: music on or off (a click is a user gesture, so it can start the music too)
    const sound = stage.querySelector(".sound");
    sound.addEventListener("pointerdown", (e) => e.stopPropagation());
    sound.addEventListener("click", () => {
      this.musicOn = !this.musicOn;
      sound.setAttribute("aria-checked", this.musicOn);
      if (!this.musicOn) this.pauseMusic();
      else if (this.audio) this.playMusic();
      else this.startMusic();
      if (!this.driving) this.drawCity(); // show or hide the random lights at once
    });
    this.updateTrack();
    const panel = stage.querySelector(".table");
    panel.inert = true; // nothing in it to reach with the keyboard until it is showing

    this.startStars();
    this.startEq();
    this.startCity();
    // the twinkling stars, the equaliser and the window lights only run while the component is on screen
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.onScreen = entry.isIntersecting;
      if (this.onScreen) {
        this.resumeStars();
        this.resumeEq();
        this.tickLights();
        this.startAttract();
        this.syncView(); // what moved while it was off screen was not drawn
      }
    });
    this.visibilityObserver.observe(this);
    this.setPrompt("insert coin"); // the first screen; once the car has set off it says "press start" at every stop
    // Touch and mouse: a tap or click sets the car off for the next billboard; a swipe right does the same; a swipe left
    // drives round to the previous one. They are told apart when the finger lifts (see onGestureEnd), so the press itself
    // does nothing. Only the main button or a finger counts: not a right click, and not a second finger.
    this.gesture = null;
    this.fromPanel = false; // set by the text panel when a press starts on it
    this.onPointer = (e) => {
      const panel = this.fromPanel;
      this.fromPanel = false;
      if (e.button !== 0 || e.isPrimary === false) return;
      this.endGesture();
      this.gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), panel, mouse: e.pointerType === "mouse" };
      window.addEventListener("pointerup", this.onGestureEnd);
      window.addEventListener("pointercancel", this.endGesture);
    };
    this.endGesture = () => {
      this.gesture = null;
      window.removeEventListener("pointerup", this.onGestureEnd);
      window.removeEventListener("pointercancel", this.endGesture);
    };
    this.onGestureEnd = (e) => {
      const g = this.gesture;
      if (!g || e.pointerId !== g.id) return;
      this.endGesture();
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      const dt = performance.now() - g.t;
      const need = Math.max(40, this.getBoundingClientRect().width * 0.1); // how far counts as a swipe
      // On the text panel a mouse drag is selecting text, so only a finger swipes there; and a press on the panel is never a tap.
      const swipeable = !(g.panel && g.mouse);
      if (swipeable && Math.abs(dx) >= need && Math.abs(dx) > 1.4 * Math.abs(dy) && dt < 1500) {
        this.swallowClick(); // the drag may end on the thing it began on, which must not count as a click as well
        if (dx > 0) this.go();
        else this.goPrevious();
      } else if (!g.panel && Math.hypot(dx, dy) < 12 && dt < 800) this.go();
      this.resumeMusic(); // a finger lifting is a gesture that allows sound, which a press is not (see resumeMusic)
    };
    this.addEventListener("pointerdown", this.onPointer);
    // the text panel scrolls (up and down) and its links and pictures are clicked, so a press on it is never a tap, but a
    // finger swipe along it still counts
    const table = stage.querySelector(".table");
    table.addEventListener("pointerdown", () => (this.fromPanel = true));    // a click on an image or video in the text panel opens it in the big popup
    table.addEventListener("click", (e) => {
      const open = e.target.closest?.(".open");
      if (open) this.openMedia(open);
    });
    // the popup: touches in it must not drive the car off, and clicking anywhere but on the media or its caption
    // (the dark backdrop, the gap around it or the close button) closes it. Closing empties it, which stops a video.
    this.viewer = this.shadowRoot.querySelector(".viewer");
    this.viewer.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.viewer.addEventListener("click", (e) => {
      if (!e.target.closest("img, video, .caption")) this.viewer.close();
    });
    this.viewer.addEventListener("close", () =>
      this.viewer.querySelector(".box").replaceChildren(),
    );
    // Keys: Enter, Space or the left arrow drive on to the next billboard (as a swipe right does) and the right arrow goes back. Letters and the
    // like do nothing (a page must not have single key shortcuts that cannot be turned off, WCAG 2.1.4). They work while
    // the component has the focus (it can be tabbed to), and on a full screen one (the fill attribute) from anywhere,
    // since there is nothing else on the page to use the keys. The text panel and the popup keep their keys (for scrolling
    // and closing), and keys meant for a text field, button or link are left alone. Shortcuts (ctrl, cmd, alt) too.
    this.onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat || e.isComposing) return;
      const next = e.key === "Enter" || e.key === " " || e.key === "ArrowLeft";
      const previous = e.key === "ArrowRight";
      if (!next && !previous) return;
      if (this.viewer?.open) return; // keys belong to the popup (Escape closes it) while it is showing
      const path = e.composedPath();
      if (!path.includes(this) && !this.hasAttribute("fill")) return;
      if (path.some((el) => el.classList?.contains("table"))) return; // the panel scrolls with the keys
      const target = path[0];
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, button, a, video, audio, [contenteditable]")
      )
        return;
      e.preventDefault(); // Space and the arrows would scroll the page
      if (next) this.go();
      else this.goPrevious();
    };
    window.addEventListener("keydown", this.onKey);
    this.startAttract();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.frame);
    this.stopAttract();
    this.pauseMusic();
    cancelAnimationFrame(this.starFrame);
    this.starFrame = 0;
    cancelAnimationFrame(this.eqFrame);
    this.eqFrame = 0;
    this.audioCtx?.close().catch(() => {});
    this.starObserver?.disconnect();
    this.cityObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    clearTimeout(this.lightTimer);
    this.removeEventListener("pointerdown", this.onPointer);
    this.endGesture?.();
    this.frame = 0;
    window.removeEventListener("keydown", this.onKey);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.isConnected) return;
    if (name === "src") {
      // (an element that was already on the page when the script loaded gets this before it has drawn itself)
      const img = this.shadowRoot.querySelector("img");
      if (img) img.src = newValue || RexLambo.defaultSrc;
    } else {
      this.applyState();
      if (name === "paused" && newValue === null) this.startAttract(); // (a no-op unless it is still the INSERT COIN screen)
      // a drive that was paused has stopped its loop (see tick): start it again
      if (name === "paused" && newValue === null && this.driving && !this.frame) {
        this.last = performance.now();
        this.frame = requestAnimationFrame((t) => this.tick(t));
      }
    }
  }

  /** Finds the CSS animations that are slowed with the car (they only exist while the component is displayed). */
  collectMotion() {
    const stage = this.shadowRoot.querySelector(".stage");
    this.motion = [...stage.querySelectorAll(".spin, .plane, .barrier, .lid, .rail")].flatMap((el) => el.getAnimations());
    this.motion.forEach((a) => (a.playbackRate = this.rate));
  }

  /** Sets how fast the wheels, road and barrier run, only touching the animations when the speed has changed. */
  setRate(rate) {
    if (rate === this.rate) return;
    this.rate = rate;
    for (const a of this.motion) a.playbackRate = rate;
  }

  /** Brings what is on screen up to date after the component has been scrolled out of view and back. */
  syncView() {
    if (this.motion.length < RexLambo.motionCount) this.collectMotion(); // it was hidden when it was set up
    for (const b of this.boards) RexLambo.place(b.el, b.p);
    this.drawCity();
    this.updateTrack();
  }

  /** Plays the soundtrack again if the browser refused it (see onGestureEnd), unless it has been switched off. */
  resumeMusic() {
    if (this.audio?.paused) this.playMusic();
  }

  /**
   * Plays the soundtrack, or carries on with it. A track played from its start waits `musicDelay` first; it is played
   * (muted) and stopped at once now, because this may be a press, and a browser that only lets sound start on a press
   * (Safari) then lets this player start on its own a second later.
   */
  playMusic() {
    const a = this.audio;
    if (!a || !this.musicOn || this.musicTimer) return; // (already waiting to start)
    if (a.currentTime > 0) {
      a.play().catch(() => {});
      return;
    }
    a.muted = true;
    a.play().catch(() => {});
    a.pause();
    a.muted = false;
    this.musicTimer = setTimeout(() => {
      this.musicTimer = 0;
      if (this.musicOn) a.play().catch(() => {}); // blocked or missing: the scene just stays quiet
    }, RexLambo.musicDelay * 1000);
  }

  /** Stops the soundtrack, including one still waiting to start. */
  pauseMusic() {
    clearTimeout(this.musicTimer);
    this.musicTimer = 0;
    this.audio?.pause();
  }

  /* ---------- driving: park at a billboard, wait for a key or touch, drive to the next ---------- */

  setPrompt(text) {
    const stage = this.shadowRoot.querySelector(".stage");
    const hint = stage.querySelector(".hint");
    // the first screen is drawn in the billboards' pixel font, like an arcade attract screen; every other hint is plain text
    if (text && stage.classList.contains("intro"))
      hint.replaceChildren(RexLambo.pixelText(text));
    else hint.textContent = text;
    stage.classList.toggle("prompt", !!text);
    // the hint is a picture of text, so say it (and what to do) in the live region too
    if (text) this.announce(`${text}. Press Enter, Space or the left arrow to start, or tap the scene.`);
  }

  /** Says something to screen readers (a polite live region), without showing it. */
  announce(message) {
    const status = this.shadowRoot.querySelector(".status");
    if (status) status.textContent = message;
  }

  /* ---------- the high score table that fades in at each stop ---------- */

  // demo content, one entry per billboard (they repeat in the same order as the billboard art)
  static tables = [
    {
      title: "ME",
      scores: [
        ["F_D", "9478"],
        ["007", "1337"],
        ["B_N", "70"],
      ],
      text: [
        "I am Nathan Brown, one of the most experienced coders on the planet. I have 30 years of experience across backend, full-stack and frontend.",
        "And yes, I am well aware a site like this isn't the best for UX, SEO, etc. Whatever, I wanted to flex some techniques and visual flair.",
        "View my resume below if you want it... It's chock-full of boring work history stuff.",
      ],
      links: [
        {
          text: "Resume",
          type: "download",
          file: "https://docs.google.com/document/d/0B6gw4traA7fATHlqeHhpZDdZS2RSWGpfRFhUUDEteXNrQVdZ/edit?usp=sharing&ouid=107557479864223568084&resourcekey=0-k2zfp49Oiu1vFoZgUSfW5Q&rtpof=true&sd=true",
        },
      ],
    },
    {
      title: "LEET SKILLS",
      scores: [
        ["HTML", "9001"],
        ["CSS", "8900"],
        ["JS", "8100"],
      ],
      text: [
        "My recent experience is in React, AstroJS and Web Components. I have built email clients, messaging dashboards and messaging clients, some standalone, some in webviews as 'miniapps'.",
        "I have also worked in Vue and Angular, and have of course incorporated all sorts of state management, from full-on Redux/Saga to Zustand to custom in-cache solutions.",
        "Further back, I built my own CMS in ASP.NET C#, worked as a WordPress developer in PHP, and created a Reddit clone with MongoDB, among many other things.",
      ],
      media: [
        {
          type: "image",
          subtitle: "Vue Analytics Dash",
          file: "./himawariCut.jpg",
        },
        {
          type: "image",
          subtitle: "My CMS - FE Editing",
          file: "./frontend1.jpg",
        },
        {
          type: "image",
          subtitle: "My CMS - BE Editing",
          file: "./backend1.jpg",
        },
        {
          type: "image",
          subtitle: "My CMS - Performance",
          file: "./speed.jpg",
        },
        {
          type: "image",
          subtitle: "AstroJS/React Miniapp Performance",
          file: "./100.png",
        },
      ],
    },
    {
      title: "THE HUMAN",
      scores: [
        ["CYCL", "64000"],
        ["YT", "29339"],
        ["TVL", "10220"],
      ],
      text: [
        "So now, a little about me...",
        "I find I spend most of my free time doing one of three things: cycling, making videos or traveling.",
        "I have four bikes at the time of writing, though hopefully I can reduce that somewhat. I also have a cycling YouTube channel, linked below. Another YouTube channel is Formula Digital, all about sim racing. Travel is something I combine with all my hobbies, traveling to F1 races and also traveling to cycle.",
      ],
      links: [
        {
          text: "Formula Digital",
          type: "youtube",
          file: "https://www.youtube.com/@FormulaDigital",
        },
        {
          text: "Bike Nonsense",
          type: "youtube",
          file: "https://www.youtube.com/@Bike-Nonsense",
        },
      ],
    },
  ];

  /** Escapes text for use in HTML content or a quoted attribute. */
  static esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  /**
   * The optional `media` list ([{ type, file, subtitle }, ...]) as one figure per entry, each with its subtitle (if
   * it has one) underneath. `type` is "image" (the default), "video" or "audio". Images and videos sit inside a
   * button that opens them in the big popup (see openMedia); a video shows its first frame with a play badge until
   * then. Audio keeps its own controls in the panel.
   */
  static mediaHTML(media) {
    if (!media?.length) return "";
    const esc = RexLambo.esc;
    const items = media
      .map((m) => {
        const file = esc(m.file);
        const caption = m.subtitle ? esc(m.subtitle) : "";
        const figcaption = caption ? `<figcaption>${caption}</figcaption>` : "";
        if (m.type === "audio")
          return `<figure class="media"><audio src="${file}" controls preload="metadata"></audio>${figcaption}</figure>`;
        const video = m.type === "video";
        const el = video
          ? `<video src="${file}#t=0.1" preload="metadata" muted playsinline></video>`
          : `<img src="${file}" alt="${caption}" loading="lazy" />`;
        return (
          `<figure class="media"><button type="button" class="open${video ? " video" : ""}" ` +
          `data-file="${file}" aria-label="Open full screen${caption ? ": " + caption : ""}">${el}</button>${figcaption}</figure>`
        );
      })
      .join("");
    // a grid of equal sized thumbnails with a gap between them (one on its own gets the full width and its own shape)
    return `<div class="gallery${media.length === 1 ? " one" : ""}">${items}</div>`;
  }

  /** Shows the image or video behind an .open button in the almost full screen popup, with its subtitle beneath. */
  openMedia(button) {
    const box = this.viewer.querySelector(".box");
    const file = button.dataset.file;
    let big;
    if (button.classList.contains("video")) {
      big = document.createElement("video");
      big.controls = true;
      big.autoplay = true;
      big.playsInline = true;
    } else {
      big = document.createElement("img");
      big.alt = button.firstElementChild.alt;
    }
    // its shape, so the CSS can size it to fill the popup (an image's is known now if it has loaded in the panel)
    const shape = () => {
      const w = big.naturalWidth || big.videoWidth;
      const h = big.naturalHeight || big.videoHeight;
      if (w && h) big.style.setProperty("--ar", w / h);
    };
    big.addEventListener("load", shape);
    big.addEventListener("loadedmetadata", shape);
    big.src = file;
    shape();
    box.replaceChildren(big);
    const caption = button.closest(".media").querySelector("figcaption");
    if (caption) {
      const c = document.createElement("div");
      c.className = "caption";
      c.textContent = caption.textContent;
      box.append(c);
    }
    this.viewer.showModal();
  }

  /**
   * The buttons for an optional `links` list ([{ text, type, file }, ...]) as one row under the text. `type` picks the
   * icon: "download" (the default, a down arrow) or "youtube" (the YouTube logo). A download link to a file on this
   * site downloads it; one to another site (which browsers won't download from) opens in a new tab instead, and so
   * does a youtube link.
   */
  static linksHTML(links) {
    if (!links?.length) return "";
    const esc = RexLambo.esc;
    return (
      `<div class="links">` +
      links
        .map((l) => {
          const youtube = l.type === "youtube";
          return `<a class="btn${youtube ? " yt" : ""}" href="${esc(l.file)}"${youtube ? "" : " download"} target="_blank" rel="noopener noreferrer">${esc(l.text)}</a>`;
        })
        .join("") +
      `</div>`
    );
  }

  /**
   * Switches vibe mode on or off. Vibe mode is always the first screen: switching it on from anywhere else sends the car
   * back to the INSERT COIN screen (see restartIntro), then the music plays (which lights the skyline's equaliser) and no
   * text panels are shown. Switching it off stops the music, as on a first screen that has not been driven yet, unless `keepMusic` is set, which is what the press that ends vibe mode uses: it goes
   * straight on to drive, which plays the music anyway.
   */
  setVibe(on, keepMusic = false) {
    if (on === this.vibe) return;
    this.vibe = on;
    const stage = this.shadowRoot.querySelector(".stage");
    const sound = stage.querySelector(".sound");
    stage.classList.toggle("vibe-on", on);
    stage.querySelector(".vibe").setAttribute("aria-checked", on);
    if (on) {
      this.vibeBefore = { musicOn: this.musicOn, playing: !!this.audio && !this.audio.paused };
      this.restartIntro();
      this.musicOn = true;
      sound.setAttribute("aria-checked", true);
      if (this.audio) this.playMusic();
      else this.startMusic();
      this.announce("Vibe mode on. Press to leave it.");
    } else {
      const before = this.vibeBefore;
      this.vibeBefore = null;
      if (before) this.musicOn = before.musicOn;
      sound.setAttribute("aria-checked", this.musicOn);
      if (!keepMusic) {
        // the switch itself: back to the silent INSERT COIN screen, with the car stopped
        this.pauseMusic(); // the car eases to a stop in attractTick
      }
      this.announce("Vibe mode off.");
    }
    if (!this.driving) this.drawCity(); // the lights follow the music (or the random flicker) at once
  }

  /** Back to the INSERT COIN screen: the billboards gone, the car at the start line cruising along the empty road, the panel hidden. */
  restartIntro() {
    const stage = this.shadowRoot.querySelector(".stage");
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.stopAttract();
    this.driving = false;
    for (const b of this.boards) b.el.remove();
    this.boards = [];
    this.billboardCount = 0;
    this.here = -1;
    this.journey = null;
    this.turbo = false;
    this.boost = 1;
    stage.querySelector(".turbo").setAttribute("aria-checked", false);
    this.hideTable();
    this.trackEls.stops.forEach((el) => (el.disabled = false));
    stage.classList.add("intro");
    this.setPrompt("insert coin");
    this.updateTrack();
    this.startAttract();
  }

  /**
   * showTable a couple of frames after the car has stopped, so the work of building the panel never holds up the frame
   * that draws the car stopping (its fade in starts after a delay anyway). Not if the car has set off again by then.
   */
  showTableSoon(idx) {
    const here = this.here;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!this.driving && this.here === here && !this.vibe) this.showTable(idx);
      }),
    );
  }

  /** Fills the table with the content for billboard `idx` and fades it in. */
  showTable(idx) {
    const data = RexLambo.tables[idx % RexLambo.tables.length];
    const table = this.shadowRoot.querySelector(".table");
    const medals = ["1ST", "2ND", "3RD"];
    table.innerHTML =
      `<h2>\u2605 ${RexLambo.esc(data.title)} \u2605</h2>` +
      `<div class="sub">HIGH SCORES</div>` +
      `<ol>${data.scores.map(([n, s], i) => `<li><span>${medals[i]}</span><span>${RexLambo.esc(n)}</span><span>${RexLambo.esc(s)}</span></li>`).join("")}</ol>` +
      data.text.map((t) => `<p>${t}</p>`).join("") +
      RexLambo.mediaHTML(data.media) +
      RexLambo.linksHTML(data.links);
    table.inert = false;
    table.setAttribute("aria-label", data.title); // the panel is a region the keyboard can reach (and scroll)
    this.shadowRoot.querySelectorAll(".stop").forEach((el, i) => {
      if (i === idx % RexLambo.tables.length) el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });
    this.announce(`Stopped at ${data.title}. Tab to read the details, or press Enter to drive on.`);
    table.scrollTop = 0; // a new panel starts at the top, not wherever the last one was scrolled to
    // read the new content's size before switching on the transition, so it always fades in from the start
    void table.offsetHeight;
    this.shadowRoot.querySelector(".stage").classList.add("table-on");
  }

  hideTable() {
    this.shadowRoot.querySelector(".stage").classList.remove("table-on");
    this.shadowRoot.querySelector(".table").inert = true; // it is invisible now, so its links must not be tabbable
  }

  /**
   * Moves the little car on the progress strip at the bottom of the stage, and lights the mini billboards it has
   * reached. The strip runs from START past one mini billboard for each entry in `tables` to the FINISH line, with
   * equal gaps: going round it, the car is at `s` gaps from START, where stop i is at s = i + 1 and the finish line
   * (which is also START again) is at s = n + 1. A position on the strip is s / (n + 1). A drive (see driveTo) covers
   * `ds` gaps from `s0`, in step with the real drive (how far the target billboard has come, target.p, out of how far
   * it goes before the car stops). A drive that goes on over the finish line carries on from START (s wraps round).
   */
  updateTrack() {
    const n = RexLambo.tables.length;
    if (!this.trackEls || !n) return;
    const round = n + 1;
    const at = (i) => (i + 1) / round;
    const target = this.boards[this.boards.length - 1];
    const j = this.journey;
    let s = 0;
    if (j && target) {
      const f = Math.min(
        1,
        Math.max(0, (target.p - j.p0) / (RexLambo.stopAt - j.p0)),
      );
      s = j.s0 + f * j.ds;
    }
    const crossing = s >= round; // past the finish line, on the way round again
    const pos = (crossing ? s - round : s) / round;
    const key = pos.toFixed(4);
    if (key !== this.trackKey) {
      this.trackKey = key;
      this.trackEls.me.style.setProperty("--at", key);
      this.trackEls.stops.forEach((el, i) =>
        el.classList.toggle("lit", pos >= at(i) - 1e-6),
      );
    }
    // a flash on the finish line as the car goes over it
    if (crossing && !this.lapFlashed) {
      this.lapFlashed = true;
      const fin = this.trackEls.finish;
      fin.classList.remove("flash");
      void fin.offsetWidth;
      fin.classList.add("flash");
    } else if (!crossing) this.lapFlashed = false;
  }

  /** Called on a drive key (see onKey) or a touch. Only does anything while the car is parked: drives on to the next billboard. */
  go() {
    if (this.vibe) this.setVibe(false, true); // any press ends vibe mode, and then does what it always does
    this.driveTo((this.here + 1) % RexLambo.tables.length);
  }

  /** A swipe left: drives round to the billboard before this one, straight past any in between (none, if there is no way back). */
  goPrevious() {
    if (this.vibe) this.setVibe(false, true);
    if (this.here < 0) return; // still at the start line
    this.goTo((this.here - 1 + RexLambo.tables.length) % RexLambo.tables.length);
  }

  /** Swallows the click that follows a swipe that began and ended on the same element. */
  swallowClick() {
    const stop = (e) => {
      e.stopPropagation();
      e.preventDefault();
    };
    this.addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => this.removeEventListener("click", stop, { capture: true }), 400);
  }

  /** Drives straight to table entry ``k`` (a click on its mini billboard), past any billboards in between. */
  goTo(k) {
    if (this.vibe) this.setVibe(false, true);
    if (k === this.here) return; // already there
    this.driveTo(k);
  }

  /**
   * Routes the music through an analyser so the equaliser in the sky can follow it: player -> analyser (to read the
   * spectrum), and player -> gain -> speakers (the gain is what sets the volume, so the equaliser always sees the
   * full level, however quiet the music is played). The browser only gives out a track's samples when it is from this
   * same site (a page opened from a file, or a track from another site, would be played silent), so then the music
   * just plays as it is and the equaliser stays still.
   */
  hookAnalyser(audio) {
    try {
      const url = new URL(audio.src, location.href);
      if (url.origin !== location.origin || location.origin === "null") return;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -88;
      analyser.maxDecibels = -28;
      const gain = ctx.createGain();
      gain.gain.value = RexLambo.musicAmplitude;
      audio.volume = 1;
      source.connect(analyser);
      source.connect(gain).connect(ctx.destination);
      this.audioCtx = ctx;
      this.analyser = analyser;
      audio.addEventListener("play", () => ctx.resume().catch(() => {}));
    } catch {
      /* no Web Audio: the music plays as it is */
    }
  }

  /**
   * The graphic equaliser, played on the lights in the buildings. This works out how high each of 40 columns of the
   * music's spectrum is (low notes on the left of the screen, high on the right, spaced the way pitch is heard), with a
   * peak that hangs a moment at each column's highest point. drawCity then lights every building's windows from the
   * ground up to the share of its own height that the column it is in front of has reached (see eqLights), so the skyline becomes the equaliser while the
   * music plays. Otherwise the buildings have no lights, except with the sound switched off, when their windows flip at random.
   * The loop runs only while music is playing (or the columns are still falling) and the component is on screen; while
   * parked it asks for the skyline to be redrawn, and while driving every frame redraws it anyway.
   */
  startEq() {
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const BARS = RexLambo.eqBars;
    const level = new Float32Array(BARS);
    const peak = new Float32Array(BARS);
    // what is drawn: each column's level and peak (as a share of the building's body) snapped to steps, and only moved to
    // another step once the real value is well past it, so a light on the edge between two steps can't flicker on and off
    const shown = (this.eqLevel = new Float32Array(BARS));
    const shownPeak = (this.eqPeak = new Float32Array(BARS));
    // the last two raw targets of each column: a target is the median of its last three, so one glitched reading from the
    // analyser (a stalled or all-zero frame when the machine is busy, or a lone spike) can't make a column jump
    const prev1 = new Float32Array(BARS);
    const prev2 = new Float32Array(BARS);
    // when each column's shown level and peak last went up: a light that has come on stays on for at least eqMinOn
    const rose = new Float64Array(BARS);
    const peakRose = new Float64Array(BARS);
    const snap = (cur, v, when, b, now) => {
      const x = v < 0.005 ? 0 : v * RexLambo.eqSteps;
      if (Math.abs(x - cur * RexLambo.eqSteps) <= RexLambo.eqHold && x > 0) return cur;
      const to = Math.round(x) / RexLambo.eqSteps;
      if (to > cur) when[b] = now;
      else if (now - when[b] < RexLambo.eqMinOn * 1000) return cur; // not down yet: the lights it would put out have only just come on
      return to;
    };
    // Each column's own range, so the lights use the whole height of the buildings whatever the music is like: the
    // quietest (lo) and loudest (hi) it has been lately, each following the column quickly outwards and slowly back
    // (over some 15 seconds), and the level is where the column is between them. (A fixed scale left loud, mastered
    // tracks always near the top.)
    const lo = new Float32Array(BARS);
    const hi = new Float32Array(BARS);
    let ranged = false;
    this.eqActive = false;
    let data = null;
    let bins = null; // each column's range of the analyser's frequency bins
    let last = 0;
    let lastSig = 0; // a fingerprint of the columns as last drawn, to skip a redraw when nothing has changed

    const loop = (now) => {
      if (!this.onScreen) {
        this.eqFrame = 0;
        return;
      }
      if (now - last < 33) {
        this.eqFrame = requestAnimationFrame(loop);
        return;
      }
      last = now;
      const live = !!this.analyser && !!this.audio && !this.audio.paused;
      if (live) {
        if (!data) {
          data = new Uint8Array(this.analyser.frequencyBinCount);
          // columns spaced evenly in pitch from 40 Hz to 14 kHz
          const hz = this.audioCtx.sampleRate / this.analyser.fftSize;
          const lo = 40 / hz;
          const hi = Math.min(14000 / hz, data.length - 1);
          bins = [];
          for (let b = 0; b <= BARS; b++) bins.push(lo * (hi / lo) ** (b / BARS));
        }
        this.analyser.getByteFrequencyData(data);
      }
      let moving = false;
      for (let b = 0; b < BARS; b++) {
        let target = 0;
        if (live) {
          const i0 = Math.floor(bins[b]);
          const i1 = Math.max(i0 + 1, Math.ceil(bins[b + 1]));
          let sum = 0;
          for (let i = i0; i < i1; i++) sum += data[i];
          const v = sum / (i1 - i0) / 255;
          if (!ranged) lo[b] = hi[b] = v;
          lo[b] += (v - lo[b]) * (v < lo[b] ? 0.2 : 0.002);
          hi[b] += (v - hi[b]) * (v > hi[b] ? 0.2 : 0.002);
          target = sum === 0 ? 0 : Math.min(1, Math.max(0, (v - lo[b]) / Math.max(hi[b] - lo[b], 0.08)));
        }
        const raw = target;
        target = Math.max(Math.min(raw, prev1[b]), Math.min(Math.max(raw, prev1[b]), prev2[b])); // the median of the three
        prev2[b] = prev1[b];
        prev1[b] = raw;
        level[b] += (target - level[b]) * (target > level[b] ? RexLambo.eqRise : RexLambo.eqFall); // up quicker than down, but never in one jump
        peak[b] = Math.max(level[b], peak[b] - 0.02);
        if (level[b] > 0.005 || peak[b] > 0.005) moving = true;
        shown[b] = snap(shown[b], level[b], rose, b, now);
        shownPeak[b] = Math.max(shown[b], snap(shownPeak[b], peak[b], peakRose, b, now));
      }
      if (live) ranged = true;
      this.eqActive = live || moving; // while true the windows are lit to show the music
      // While driving, every frame redraws the skyline anyway. Parked, redraw only if a column has moved far enough to
      // light or darken a window (in silence, or when the music has paused, nothing has).
      if (this.driving || this.attracting) lastSig = -1; // (the vibe mode cruise redraws every frame too)
      else {
        let sig = this.eqActive ? 1 : 0;
        for (let b = 0; b < BARS; b++)
          sig = (sig * 31 + Math.round(shown[b] * 64) + Math.round(shownPeak[b] * 64) * 7) | 0;
        if (sig !== lastSig) {
          lastSig = sig;
          this.drawCity();
        }
      }
      this.eqFrame = this.eqActive ? requestAnimationFrame(loop) : 0;
    };
    this.resumeEq = () => {
      if (!still && !this.eqFrame && this.onScreen)
        this.eqFrame = requestAnimationFrame(loop);
    };
  }

  /**
   * Starts the soundtrack (once). The tracks in `RexLambo.music` play in a random order, at `musicAmplitude`. Every
   * track is played once before any is repeated (a shuffle, reshuffled when the list runs out), and the first track of
   * a new shuffle is never the one that has just played.
   */
  startMusic() {
    if (this.audio || !this.musicOn || !RexLambo.music.length) return;
    let queue = [];
    let last = null;
    const next = () => {
      if (!queue.length) {
        queue = [...RexLambo.music];
        for (let i = queue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [queue[i], queue[j]] = [queue[j], queue[i]];
        }
        // don't start the new round with the track that just finished
        if (queue.length > 1 && queue[0] === last) queue.push(queue.shift());
      }
      last = queue.shift();
      return last;
    };
    const audio = new Audio(next());
    audio.volume = RexLambo.musicAmplitude;
    audio.addEventListener("ended", () => {
      audio.src = next();
      this.playMusic(); // after the same short wait as the first
    });
    this.audio = audio;
    this.hookAnalyser(audio);
    audio.addEventListener("play", () => this.resumeEq());
    this.playMusic();
  }

  /**
   * Sets the car off for table entry `k`. The billboards always come round in order, so the real road gets one
   * billboard for every entry from the next one up to `k` (going on round past the last one if `k` is behind the
   * car), spaced a `gap` apart with `k`'s the furthest away. The car only stops when it gets level with the last
   * (newest) billboard, so it drives past the others on the way.
   */
  driveTo(k) {
    if (this.driving) return;
    // ignore input while this page of the demo is hidden
    if (this.checkVisibility && !this.checkVisibility()) return;
    const n = RexLambo.tables.length;
    const c = this.here;
    let steps = (((k - c) % n) + n) % n; // billboards to put on the road
    if (steps === 0) steps = n;
    const wraps = c >= 0 && k <= c; // the way round goes over the finish line
    this.journey = {
      s0: c + 1, // where the car is on the strip
      ds: steps + (wraps ? 1 : 0), // gaps to go on the strip
      p0: -(steps - 1) * RexLambo.stopAt, // where the newest billboard starts
    };
    this.here = k;
    this.driving = true;
    this.stopAttract(); // the car keeps the speed it has (speedNow) and the road its place (cityBlocks)
    this.trackEls?.stops.forEach((el) => (el.disabled = true));
    this.shadowRoot.querySelector(".stage").classList.remove("intro"); // the big INSERT COIN screen is over for good
    this.startMusic();
    this.resumeMusic(); // (a no-op unless the browser refused it earlier, e.g. a touch is not a gesture that allows sound)
    if (this.motion.length < RexLambo.motionCount) this.collectMotion();
    this.setPrompt("");
    this.announce("Driving.");
    this.hideTable();
    for (let i = 0; i < steps; i++) this.spawn(-i * RexLambo.stopAt);
    this.updateTrack();
    // reduced motion: no drive, the car is just there at the billboard (the wheels and the road are paused anyway)
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.arriveNow();
      return;
    }
    this.last = performance.now();
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  /**
   * The INSERT COIN screen in vibe mode: the car cruises along an empty road (without vibe mode it waits there stopped), with no billboards, the wheels
   * spinning and the road, barrier and skyline scrolling round and round (the skyline repeats every `cityPeriod` blocks and
   * the road's pattern every block). A press ends vibe mode and it (see driveTo) and the car carries on from the speed it has. It does
   * nothing for reduced motion, while paused, or while the component is off screen (it starts again when it is back).
   */
  startAttract() {
    if (this.attracting || this.driving || this.frozen || !this.onScreen) return;
    if (!this.shadowRoot.querySelector(".stage").classList.contains("intro")) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!this.vibe) {
      // the first screen starts with the car stopped; only vibe mode has it cruise
      if (this.motion.length < RexLambo.motionCount) this.collectMotion();
      return;
    }
    this.attracting = true;
    if (this.motion.length < RexLambo.motionCount) this.collectMotion(); // it was hidden when it was set up
    // The wheels turn with a compositor animation, which the browser only starts a moment after the page has first been drawn
    // (a second or more on a slow machine), while the road, which is drawn on the page itself, starts at once. Setting
    // off before the wheels had started made the car move with its wheels still. So wait until every animation is running.
    const begin = () => {
      if (!this.attracting || this.attractFrame) return;
      this.last = performance.now();
      this.attractFrame = requestAnimationFrame((t) => this.attractTick(t));
    };
    Promise.all(this.motion.map((a) => a.ready)).then(begin, begin);
  }

  stopAttract() {
    this.attracting = false;
    cancelAnimationFrame(this.attractFrame);
    this.attractFrame = 0;
  }

  attractTick(now) {
    this.attractFrame = 0;
    if (!this.attracting) return;
    if (this.frozen || !this.onScreen) {
      this.stopAttract();
      this.speedNow = 0;
      this.setRate(0);
      return;
    }
    const dt = Math.max(0, Math.min((now - this.last) / 1000, 0.05));
    this.last = now;
    if (this.motion.length < RexLambo.motionCount) this.collectMotion(); // it was hidden when it was set up
    if (this.vibe) {
      this.speedNow = Math.min(RexLambo.attractSpeed, this.speedNow + dt * 0.5); // eases up to its cruising speed
      this.boost += (2 - this.boost) * Math.min(1, dt * 4); // vibe mode cruises at TURBO speed, which a press then eases back from
    } else {
      // vibe mode has been switched off: ease down to a stop
      this.speedNow *= Math.exp(-dt * 2.5);
      this.boost += (1 - this.boost) * Math.min(1, dt * 4);
      if (this.speedNow < 0.01) {
        this.stopAttract();
        this.speedNow = 0;
        this.boost = 1;
        this.setRate(0);
        this.drawCity();
        return;
      }
    }
    const blocks = (this.speedNow * dt) / (this.speedValue * RexLambo.roadPerSpin);
    this.cityBlocks = (this.cityBlocks + blocks * this.boost) % RexLambo.cityPeriod;
    this.setRate(this.speedNow * this.boost);
    this.drawCity();
    this.attractFrame = requestAnimationFrame((t) => this.attractTick(t));
  }

  /** Puts the billboards where they are when the car has stopped at the newest one, with no drive in between (reduced motion). */
  arriveNow() {
    const target = this.boards[this.boards.length - 1];
    const by = RexLambo.stopAt - target.p;
    for (const b of this.boards) {
      b.p += by;
      RexLambo.place(b.el, b.p);
    }
    this.boards = this.boards.filter((b) => (b.p < 1 ? true : (b.el.remove(), false)));
    this.cityBlocks = (this.cityBlocks + by * RexLambo.trip) % RexLambo.cityPeriod;
    this.speedNow = 0;
    this.setRate(0);
    this.drawCity();
    this.updateTrack();
    this.driving = false;
    this.trackEls.stops.forEach((el) => (el.disabled = false));
    this.showTableSoon(target.idx);
  }

  /**
   * One frame of the world. `speedNow` eases up to 1 while driving and eases down to 0 over the
   * last few road blocks before the newest billboard reaches the car. The wheels, the road and every
   * billboard all move at that same speed so nothing slides against anything else.
   */
  tick(now) {
    this.frame = 0;
    // `now` is when the frame started, which can be a hair before the performance.now() taken when the key was
    // pressed, so the first dt after a press can come out negative. Clamp it, never let time run backwards.
    const realDt = Math.max(0, Math.min((now - this.last) / 1000, 0.05));
    this.last = now;
    if (this.frozen) {
      // paused: nothing moves, so let the loop stop rather than redraw an unchanged scene 60 times a second (removing the
      // paused attribute starts it again, see attributeChangedCallback)
      this.speedNow = 0;
      this.setRate(0);
      return;
    }
    const speed = this.speedValue;
    // TURBO runs the whole drive (speeding up, cruising and braking) at twice the pace, by making time (dt) pass twice
    // as fast. Flipping the switch eases the boost between 1 and 2 over a fraction of a second rather than jumping.
    const goal = this.turbo ? 2 : 1;
    this.boost += (goal - this.boost) * Math.min(1, realDt * 4);
    if (Math.abs(goal - this.boost) < 0.005) this.boost = goal;
    const dt = realDt * this.boost;

    const target = this.boards[this.boards.length - 1];
    // road blocks left before the car should be level with its billboard
    const left = target ? (RexLambo.stopAt - target.p) * RexLambo.trip : 0;
    // braking at a steady rate: speed falls with the square root of the distance still to go
    const brake = Math.min(1, Math.sqrt(Math.max(left, 0) / 2.5));
    const accel = Math.min(1, this.speedNow + dt); // speeds up by 1 (full speed) per second
    let speedNow = Math.max(0, Math.min(accel, brake));

    // billboards advance at road speed: one block takes speed * roadPerSpin seconds
    let step = (speedNow * dt) / (RexLambo.trip * speed * RexLambo.roadPerSpin);
    // The car has stopped only when it has actually reached the billboard, never just because its speed is 0. It arrives
    // in the frame whose step would reach (or pass) the billboard, by exactly the distance left: going past it and being
    // put back the next frame made the billboard jump back a little just before the stop. (The braking slows it steadily
    // right down to the billboard; calling it there from 0.01 blocks out made the last step several times the one before.)
    let arrived = false;
    if (target && (left <= 0.0001 || step * RexLambo.trip >= left)) {
      step = Math.max(0, left) / RexLambo.trip;
      arrived = true;
      speedNow = 0;
    }
    this.speedNow = speedNow;
    // Nothing is drawn while the component is scrolled out of view (syncView catches it up when it comes back), and
    // nothing is redrawn that has not moved.
    const draw = (this.onScreen && step !== 0) || arrived;
    let gone = false;
    for (const b of this.boards) {
      b.p += step;
      if (b === target && arrived) b.p = RexLambo.stopAt;
      if (draw) RexLambo.place(b.el, b.p);
      if (b.p >= 1) gone = true;
    }
    // drop the billboards that have gone past
    if (gone)
      this.boards = this.boards.filter((b) =>
        b.p < 1 ? true : (b.el.remove(), false),
      );

    // the cityscape is part of the ground, so it scrolls at road speed too, wrapping once per pattern repeat
    this.cityBlocks =
      (this.cityBlocks + step * RexLambo.trip) % RexLambo.cityPeriod;
    if (draw) {
      this.drawCity();
      this.updateTrack();
    }

    this.setRate(this.speedNow * this.boost);

    if (arrived) {
      this.driving = false;
      this.trackEls.stops.forEach((el) => (el.disabled = false));
      this.showTableSoon(target.idx);
      return; // parked, so nothing to animate until the next key press
    }
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  /**
   * Faint twinkling stars for the sky, drawn on one canvas rather than as a hundred animated elements (that many
   * separately animated layers made the browser drop parts of the 3D road scene). A fixed seed keeps the stars in
   * the same places on every load. Positions are fractions of the sky, sizes are in percent of the stage width.
   */
  static makeStars() {
    let seed = 99;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const tints = ["255,255,255", "255,255,255", "255,214,240", "201,234,255"];
    const stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: rnd(),
        y: Math.pow(rnd(), 1.5), // more of them near the top, fewer by the horizon glow
        r: 0.07 + rnd() * 0.1, // radius, percent of stage width
        tint: tints[Math.floor(rnd() * tints.length)],
        peak: 0.35 + rnd() * 0.45, // brightest it gets
        period: 2 + rnd() * 4, // seconds per twinkle
        phase: rnd() * Math.PI * 2,
      });
    }
    // each star's colour is worked out once (its brightness is set with globalAlpha), and stars of a colour are drawn
    // together, so a frame builds no strings and hardly changes the canvas state
    stars.forEach((s) => (s.fill = `rgb(${s.tint})`));
    stars.sort((a, b) => (a.fill < b.fill ? -1 : a.fill > b.fill ? 1 : 0));
    return stars;
  }

  /** Sizes the star canvas to the sky (at device resolution) and starts the twinkling loop. */
  startStars() {
    const canvas = this.shadowRoot.querySelector(".stars");
    const ctx = canvas.getContext("2d");
    const stars = RexLambo.makeStars();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // A shooting star: every RexLambo.shootingEvery seconds there is a 1 in RexLambo.shootingOdds chance of one, starting
    // anywhere in the sky and streaking down to the lower left, from the top right, for about a second. Its place
    // is kept as fractions of the canvas, so a resize in mid flight doesn't matter.
    let shooter = null;
    let nextRoll = 0;
    const spawnShooter = (now) => {
      const angle = ((12 + Math.random() * 25) * Math.PI) / 180; // slant below the horizontal
      shooter = {
        t0: now,
        dur: 900 + Math.random() * 400, // ms
        x: Math.random(), // anywhere across the sky
        y: 0.02 + Math.random() * 0.7, // and anywhere down it
        dx: -Math.cos(angle), // always from the top right down to the lower left
        dy: Math.sin(angle),
      };
    };
    this.shootingStar = () => spawnShooter(performance.now()); // for trying it out: this.shootingStar()

    let lastDraw = 0;
    let designW = 1; // canvas pixels across the layout box, set by size()
    const draw = (now) => {
      const w = canvas.width;
      const h = canvas.height;
      const unit = designW / 100; // 1% of the width of the layout box (the sky can be wider, see .view)
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const wave = still
          ? 0.5
          : 0.5 +
            0.5 * Math.sin((now / 1000 / s.period) * Math.PI * 2 + s.phase);
        const alpha = 0.12 + (s.peak - 0.12) * wave;
        const x = s.x * w;
        const y = s.y * h;
        const r = Math.max(0.6, s.r * unit);
        ctx.fillStyle = s.fill;
        ctx.globalAlpha = alpha * 0.25; // soft halo
        ctx.beginPath();
        ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha; // bright core
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (shooter) {
        const k = (now - shooter.t0) / shooter.dur; // 0 to 1 over its flight
        if (k >= 1) shooter = null;
        else if (k >= 0) {
          const run = designW * 0.3; // how far it travels
          const hx = shooter.x * w + shooter.dx * run * k;
          const hy = shooter.y * h + shooter.dy * run * k;
          const tail = Math.min(run * k, designW * 0.12); // the streak behind the head grows to this long
          const tx = hx - shooter.dx * tail;
          const ty = hy - shooter.dy * tail;
          const fade = Math.sin(Math.PI * k); // in, then out
          const grad = ctx.createLinearGradient(tx, ty, hx, hy);
          grad.addColorStop(0, "rgba(255,255,255,0)");
          grad.addColorStop(1, `rgba(255,240,255,${(0.9 * fade).toFixed(3)})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = Math.max(1, unit * 0.14);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(hx, hy);
          ctx.stroke();
          ctx.fillStyle = `rgba(255,255,255,${(0.95 * fade).toFixed(3)})`; // the bright head
          ctx.beginPath();
          ctx.arc(hx, hy, Math.max(1, unit * 0.16), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    // resizing clears the canvas, so paint it again straight away (with reduced motion that is the only painting)
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      designW = Math.max(1, this.shadowRoot.querySelector(".view").clientWidth * dpr);
      draw(lastDraw);
    };
    size();
    this.starObserver = new ResizeObserver(size);
    this.starObserver.observe(canvas);

    // The twinkle loop. It stops itself while the component is off screen and resumeStars() starts it again.
    const loop = (now) => {
      if (!this.onScreen) {
        this.starFrame = 0;
        return;
      }
      this.starFrame = requestAnimationFrame(loop);
      // a twinkle takes seconds, so 15 frames a second is plenty; a shooting star needs 30 to look smooth
      if (now - lastDraw < (shooter ? 33 : 66)) return;
      lastDraw = now;
      if (!nextRoll) nextRoll = now + RexLambo.shootingEvery * 1000;
      if (now >= nextRoll) {
        nextRoll = now + RexLambo.shootingEvery * 1000;
        if (!shooter && Math.random() < 1 / RexLambo.shootingOdds) spawnShooter(now);
      }
      draw(now);
    };
    this.resumeStars = () => {
      if (!still && !this.starFrame)
        this.starFrame = requestAnimationFrame(loop);
    };
    this.resumeStars();
  }

  // shooting stars: a chance of one every this many seconds, and the odds against (2.5 is a 2 in 5 chance)
  static shootingEvery = 8;
  static shootingOdds = 2.5; // a 2 in 5 chance
  // how far the camera is from the scene, in cqw: bigger means less perspective (flatter, less foreshortening)
  static perspective = 200;
  // the equaliser on the building lights: 40 columns of spectrum across the screen, and its colours (cyan low, through
  // violet, to hot pink high)
  static eqBars = 40;
  static eqSteps = 30; // the levels drawn are whole steps of 1/eqSteps of a building's height
  static eqHold = 0.8; // a level moves to another step only when the real one is this many steps past it (over half, so it can't flicker)
  static eqMinOn = 0.15; // seconds: once lit, an equaliser light stays on at least this long, so none flickers
  static eqRise = 0.2; // how much of the way to a higher level a column goes in each step (30 a second): lower is smoother
  static eqFall = 0.1; // and to a lower one
  static eqCell = 2; // the equaliser's lights are this many times the smallest size they used to be (a cell of 6 units, a light of 4)
  static eqBelow = 110; // how far below the ground, in world units, the lights go on down a building's body (to the barrier)
  static eqColors = ["0,229,255", "60,190,255", "130,130,255", "190,80,255", "240,60,200", "255,46,147"].map((c) => `rgba(${c},0.9)`);
  // the road's tilt as in the CSS (rotateZ(42deg) then rotateX(70deg)), as cosines and sines for drawCity
  static tilt = {
    cz: Math.cos((42 * Math.PI) / 180),
    sz: Math.sin((42 * Math.PI) / 180),
    cx: Math.cos((70 * Math.PI) / 180),
    sx: Math.sin((70 * Math.PI) / 180),
  };
  // how far down (in cqw) the building walls run below ground level. The equaliser's lights go all the way down it,
  // because the lower part of every wall is what shows between the roofs and the barrier.
  static sinkDepth = 300;
  static cityPeriod = 6; // road blocks before the building pattern repeats

  /**
   * The skyline: boxes standing on the ground beyond the far edge of the road. One pattern `cityPeriod` blocks long is
   * generated (with a fixed seed so it is always the same) and repeated down the strip, so the strip can scroll round
   * forever without a visible join.
   *
   * This is drawn on a canvas, projected by hand with the same maths as the CSS 3D scene (see drawCity), rather than
   * built from elements. As a hundred or so 3D boxes (several hundred elements) it overloaded the browser's
   * compositor on wide windows, and parts of the city and the road flickered in and out.
   */
  static makeCity() {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const colors = ["#ff2e93", "#09c", "#b84dff", "#ff2e93", "#09c"];
    // rows of buildings, nearest the road first: [how many per repeat, distance from the road, extra height]
    const rows = [
      [6, 290, 0],
      [6, 420, 15],
      [5, 560, 30],
      [5, 720, 45],
    ];
    const pattern = [];
    rows.forEach(([count, dist, extra]) => {
      for (let i = 0; i < count; i++) {
        pattern.push({
          y: (i + rnd() * 0.6) * (RexLambo.cityPeriod / count),
          x: -(dist + rnd() * 60),
          w: 20 + rnd() * 30,
          d: 20 + rnd() * 30,
          h: 9 + rnd() * 20 + extra * 0.3,
          c: colors[Math.floor(rnd() * colors.length)],
        });
      }
    });

    // window lights: a grid of 6 x 6 cqw cells with a 4 x 4 window in each. About 10% of the cells are windows that
    // can light up and half of those start lit (so about 5% overall), mostly a soft warm amber with the odd peach or
    // pink one. Each window then flips on or off by itself, instantly, every 30 to 90 seconds (see updateLights). They
    // are only shown while the sound is switched off (the music's equaliser uses the windows otherwise). Worked out
    // with its own seed. Windows are grouped by colour and brightness so drawCity can fill a whole group in one go.
    let wseed = 5;
    const wrnd = () => {
      wseed = (wseed * 1664525 + 1013904223) % 4294967296;
      return wseed / 4294967296;
    };
    const lights = [
      "#ffcf7a",
      "#ffcf7a",
      "#ffcf7a",
      "#ffcf7a",
      "#ffe6b0",
      "#ffe6b0",
      "#ffb07a",
      "#ff8fc4",
    ];
    const born = performance.now();
    const cells = []; // every window, once each: repeats of a building share their windows
    const windows = (cols, rowsN) => {
      const groups = new Map();
      for (let row = 0; row < rowsN; row++) {
        for (let col = 0; col < cols; col++) {
          const roll = wrnd();
          if (roll > 0.1) continue;
          const color = lights[Math.floor(wrnd() * lights.length)];
          const alpha =
            roll < 0.015 || (roll > 0.05 && roll < 0.065) ? 0.4 : 0.8;
          const key = color + alpha;
          let group = groups.get(key);
          if (!group) groups.set(key, (group = { color, alpha, cells: [] }));
          const cell = {
            col,
            row,
            on: roll <= 0.05, // lit now
            // when it flips next: spread over the first 90s so they never flip in a clump
            next: born + Math.random() * 90000,
          };
          group.cells.push(cell);
          cells.push(cell);
        }
      }
      return [...groups.values()];
    };

    // The skyline scrolls by one repeat of the pattern and then jumps back, so every repeat of a building must look
    // exactly the same (same windows, lit in the same way at the same moment) or the lights would visibly change
    // each time it wraps. So the windows are worked out once per building in the pattern and shared by every repeat.
    const cols = (n) => Math.max(1, Math.floor(n / 6));
    const shared = pattern.map((b) => ({
      roadWin: windows(cols(b.d), cols(b.h + RexLambo.sinkDepth)), // the face looking at the road
      nearWin: windows(cols(b.w), cols(b.h + RexLambo.sinkDepth)), // the face looking at the camera
    }));
    const buildings = [];
    for (let rep = 0; rep < 10; rep++) {
      pattern.forEach((b, i) => {
        buildings.push({
          ...b,
          by: b.y + rep * RexLambo.cityPeriod, // position along the road, in blocks
          ...shared[i],
          // scratch fields for drawCity: where the building is this frame, and how far from the camera
          y: 0,
          f: 0,
        });
      });
    }
    return { buildings, cells };
  }

  /** A random wait of 30 to 90 seconds before a window next flips. */
  static nextLightDelay() {
    return 30000 + Math.random() * 60000;
  }

  /**
   * Flips every window whose time has come, instantly. Returns true if any window flipped, so the caller knows the
   * skyline needs redrawing. Cheap when nothing is due: `nextFlip` is the earliest time any window is due.
   */
  updateLights(now = performance.now()) {
    if (now < this.nextFlip) return false;
    let flipped = false;
    let soonest = Infinity;
    for (const w of this.lightCells) {
      if (now >= w.next) {
        // a window that is long overdue (the page was off screen or in a background tab) just waits again, so they
        // don't all flip together when the page comes back
        if (now - w.next < 5000) {
          w.on = !w.on;
          flipped = true;
        }
        w.next = now + RexLambo.nextLightDelay();
      }
      if (w.next < soonest) soonest = w.next;
    }
    this.nextFlip = soonest;
    return flipped;
  }

  /** Applies any window flips that are due, redraws the skyline if they show, and sleeps until the next flip. */
  tickLights() {
    clearTimeout(this.lightTimer);
    // while driving, every frame redraws the skyline anyway; the lights only show with the sound off
    if (this.updateLights() && !this.driving && !this.musicOn) this.drawCity();
    if (!this.onScreen) return; // the visibility observer restarts this when the car is back in view
    this.lightTimer = setTimeout(
      () => this.tickLights(),
      // at most one tick (and so one redraw) every second and a half: with a thousand windows flipping about once a
      // minute each, a tick for every single flip would redraw the whole skyline some ten times a second
      Math.max(1500, this.nextFlip - performance.now()),
    );
  }

  /** Creates the skyline canvas's 2D context, sizes it to the stage and works out the scene's geometry. */
  startCity() {
    const canvas = this.shadowRoot.querySelector(".skyline");
    this.cityCtx = canvas.getContext("2d");
    const city = RexLambo.makeCity();
    this.cityData = city.buildings;
    this.lightCells = city.cells;
    this.nextFlip = 0;
    this.cityScratch = new Float64Array(36); // projected points, reused every frame (see drawCity)
    const size = () => {
      // The skyline is redrawn every frame, so its canvas is held to about 2560 pixels wide: at 4K a full size one was too much to
      // redraw in time and the equaliser lagged.
      const dpr = Math.min(window.devicePixelRatio || 1, 2, 2560 / Math.max(1, canvas.clientWidth));
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      const stage = this.shadowRoot
        .querySelector(".stage")
        .getBoundingClientRect();
      const scene = this.shadowRoot
        .querySelector(".scene")
        .getBoundingClientRect();
      // how much wider than the layout box the stage is (0 when it is the same), for the road's width (see --wx)
      const view = this.shadowRoot.querySelector(".view").getBoundingClientRect();
      const ex = Math.max(0, Math.round((stage.width / view.width - 1) * 20) / 20);
      this.shadowRoot.querySelector(".stage").style.setProperty("--ex", ex);
      this.cityGeom = {
        k: canvas.width / stage.width, // canvas pixels per CSS pixel
        u: scene.width / 100, // CSS pixels per cqw (inside the scene a cqw is 1% of its width)
        // the point the 3D scene is built around: 62% across and down the scene, in stage pixels
        ox: scene.left - stage.left + scene.width * 0.52,
        oy: scene.top - stage.top + scene.height * 0.62,
      };
      this.drawCity();
    };
    size();
    this.cityObserver = new ResizeObserver(size);
    this.cityObserver.observe(canvas);
    this.tickLights();
  }

  /**
   * Draws the skyline with the same projection the CSS gives the road, so the buildings stand on the ground plane
   * beside it. The world is laid out like the .world element: x across the road (negative is the far side), y along
   * it in cqw (the strip is shifted back by 20 blocks and by `cityBlocks` as the car drives), z up. A point is turned
   * about the middle of the road strip by rotateZ(42deg) then rotateX(70deg), and then foreshortened by the
   * perspective (RexLambo.perspective, centred where the scene is built around). Buildings are painted furthest first.
   *
   * This runs every frame while driving, so it avoids allocating: projected points are written into one reused
   * Float64Array `S` (three numbers per point: screen x, screen y and the perspective scale), and the lit windows of
   * a building are added to one path per colour so each colour is a single fill.
   */
  drawCity() {
    const g = this.cityGeom;
    const ctx = this.cityCtx;
    if (!g || !ctx) return;
    const canvas = ctx.canvas;
    const W = canvas.width / g.k;
    const H = canvas.height / g.k;
    ctx.setTransform(g.k, 0, 0, g.k, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const S = this.cityScratch;
    // offsets of the building's corners in S: bottom (A B C D) then top (A2 B2 C2 D2), then three spare points
    const A = 0,
      B = 3,
      C = 6,
      D = 9,
      A2 = 12,
      B2 = 15,
      C2 = 18,
      D2 = 21,
      P0 = 24,
      P1 = 27,
      P2 = 30,
      P3 = 33;

    const { cz, sz, cx, sx } = RexLambo.tilt;
    const road = 76; // --w in cqw
    const persp = RexLambo.perspective;
    // projects a point into S at offset o. False if it is at or behind the camera.
    const proj = (x, y, z, o) => {
      const dx = x - road / 2;
      const dy = y - 30 * road;
      const x1 = dx * cz - dy * sz;
      const y1 = dx * sz + dy * cz;
      const y2 = y1 * cx - z * sx;
      const z2 = y1 * sx + z * cx;
      const d = persp - z2;
      if (d < 8) return false;
      const f = persp / d;
      S[o] = g.ox + x1 * f * g.u;
      S[o + 1] = g.oy + y2 * f * g.u;
      S[o + 2] = f;
      return true;
    };

    const shift = -20 - this.cityBlocks; // blocks, as in the strip's transform
    const list = [];
    for (const b of this.cityData) {
      b.y = road * (shift + b.by);
      if (!proj(b.x + b.w / 2, b.y + b.d / 2, 0, P0)) continue;
      b.f = S[P0 + 2];
      list.push(b);
    }
    list.sort((a, c) => a.f - c.f); // furthest (smallest scale) first

    const poly = (a, b, c, d, fill, stroke, lw) => {
      ctx.beginPath();
      ctx.moveTo(S[a], S[a + 1]);
      ctx.lineTo(S[b], S[b + 1]);
      ctx.lineTo(S[c], S[c + 1]);
      ctx.lineTo(S[d], S[d + 1]);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    };

    // The lit windows on one face of a building: one path and one fill for each colour. On the road face the windows
    // run along y at x = fixed, on the camera face along x at y = fixed (`alongX`).
    const lit = (groups, alongX, fixed, start, h) => {
      for (const group of groups) {
        let any = false;
        ctx.beginPath();
        for (const wn of group.cells) {
          if (!wn.on) continue;
          any = true;
          const a = start + wn.col * 6;
          const zt = h - wn.row * 6;
          if (alongX) {
            proj(a, fixed, zt, P0);
            proj(a + 4, fixed, zt, P1);
            proj(a + 4, fixed, zt - 4, P2);
            proj(a, fixed, zt - 4, P3);
          } else {
            proj(fixed, a, zt, P0);
            proj(fixed, a + 4, zt, P1);
            proj(fixed, a + 4, zt - 4, P2);
            proj(fixed, a, zt - 4, P3);
          }
          ctx.moveTo(S[P0], S[P0 + 1]);
          ctx.lineTo(S[P1], S[P1 + 1]);
          ctx.lineTo(S[P2], S[P2 + 1]);
          ctx.lineTo(S[P3], S[P3 + 1]);
          ctx.closePath();
        }
        if (!any) continue;
        ctx.globalAlpha = group.alpha;
        ctx.fillStyle = group.color;
        ctx.fill();
      }
    };

    // The windows of one face of a building as equaliser lights. A building's body, as seen, runs from its roof (h) down
    // past the ground to the barrier in front, since the ground between them isn't drawn and the walls go on down below it,
    // so the equaliser uses that whole length: T = h + EQ_BELOW units, with the windows laid out in a grid
    // (cells of 6 x eqCell units with a window 2 smaller in each, rows counted down from the roof). Every window from the foot of
    // the body up to `lvl` (measured from the foot, 0 to T) is lit, one path and one fill for each colour band up the
    // body, and the window at `pk` is a pale cap. `m` makes the cells m times bigger (windows of m x m cells joined up); every building uses the same m (eqCell),
    // so the lights are one size in the world and look smaller on the far buildings only through the perspective.
    const eqLights = (alongX, fixed, start, span, h, lvl, pk, m) => {
      const cs = 6 * m;
      const ws = cs - 2;
      const T = h + RexLambo.eqBelow;
      const cols = Math.max(1, Math.floor(span / cs));
      // the lights are spread across the face with the same gap between them as at both edges (not packed from one edge, which
      // left the leftover width as a wider gap at the other)
      const gap = Math.max(0, (span - cols * ws) / (cols + 1));
      const quad = (col, zt) => {
        const a = start + gap + col * (ws + gap);
        if (alongX) {
          proj(a, fixed, zt, P0);
          proj(a + ws, fixed, zt, P1);
          proj(a + ws, fixed, zt - ws, P2);
          proj(a, fixed, zt - ws, P3);
        } else {
          proj(fixed, a, zt, P0);
          proj(fixed, a + ws, zt, P1);
          proj(fixed, a + ws, zt - ws, P2);
          proj(fixed, a, zt - ws, P3);
        }
        ctx.moveTo(S[P0], S[P0 + 1]);
        ctx.lineTo(S[P1], S[P1 + 1]);
        ctx.lineTo(S[P2], S[P2 + 1]);
        ctx.lineTo(S[P3], S[P3 + 1]);
        ctx.closePath();
      };
      const colors = RexLambo.eqColors;
      const band = T / colors.length;
      const rows = Math.floor((T - cs) / cs); // the last row, a window's height up from the foot
      for (let ci = 0; ci < colors.length; ci++) {
        // rows whose height above the foot (u = T - row * cs) is in this colour's band and no higher than the level
        const top = Math.min((ci + 1) * band, lvl + ws);
        const r0 = Math.max(0, Math.ceil((T - top) / cs));
        const r1 = Math.min(Math.ceil((T - ci * band) / cs) - 1, rows);
        if (r1 < r0) continue;
        ctx.beginPath();
        for (let r = r0; r <= r1; r++)
          for (let c = 0; c < cols; c++) quad(c, h - r * cs);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = colors[ci];
        ctx.fill();
      }
      const rp = Math.max(0, Math.ceil((T - pk - ws) / cs));
      if (rp <= rows && T - rp * cs > lvl + ws) {
        ctx.beginPath();
        for (let c = 0; c < cols; c++) quad(c, h - rp * cs);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(255,225,245,0.95)";
        ctx.fill();
      }
    };

    // The walls run on down below ground level (a long way, in cqw) so their bottoms are never seen: they pass
    // behind the barrier, which is painted over the canvas, rather than ending in a line in the open.
    const sink = -RexLambo.sinkDepth;
    for (const b of list) {
      const x0 = b.x;
      const x1 = b.x + b.w;
      const y0 = b.y;
      const y1 = b.y + b.d;
      const h = b.h;
      if (
        !(
          proj(x0, y0, sink, A) &&
          proj(x1, y0, sink, B) &&
          proj(x1, y1, sink, C) &&
          proj(x0, y1, sink, D) &&
          proj(x0, y0, h, A2) &&
          proj(x1, y0, h, B2) &&
          proj(x1, y1, h, C2) &&
          proj(x0, y1, h, D2)
        )
      )
        continue;
      let minX = Infinity;
      let maxX = -Infinity;
      for (let o = 0; o < 24; o += 3) {
        if (S[o] < minX) minX = S[o];
        if (S[o] > maxX) maxX = S[o];
      }
      if (maxX < -20 || minX > W + 20) continue; // off to the side

      const lw = Math.max(0.7 / g.k, 0.35 * g.u * S[C + 2]);
      // the face looking at the camera, then the face looking at the road, then the roof
      poly(D, C, C2, D2, "#14072f", b.c, lw);
      poly(B, C, C2, B2, "#1c0b42", b.c, lw);
      poly(A2, B2, C2, D2, "#26105a", b.c, lw);

      // faint floor lines in the building's accent colour, every 12cqw up each wall
      ctx.lineWidth = Math.max(0.5 / g.k, lw * 0.4);
      ctx.strokeStyle = b.c;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      for (let z = h - 12; z > 4; z -= 12) {
        proj(x0, y1, z, P0); // left end of the camera face
        proj(x1, y1, z, P1); // the corner where the two faces meet
        proj(x1, y0, z, P2); // far end of the road face
        ctx.moveTo(S[P0], S[P0 + 1]);
        ctx.lineTo(S[P1], S[P1 + 1]);
        ctx.moveTo(S[P2], S[P2 + 1]);
        ctx.lineTo(S[P1], S[P1 + 1]);
      }
      ctx.stroke();

      if (this.eqActive) {
        // the music: this building's windows light up to the height of the spectrum where it is on the screen. That is
        // read between the two nearest columns by where the building's middle is, so a building passing from one column to
        // the next changes smoothly rather than jumping to its neighbour's level. (It used to follow where the building
        // would be at normal speed, so TURBO didn't speed the equaliser up, but in vibe mode, always at TURBO, that drifted
        // ever further from where the buildings are and buildings flashed between unrelated columns.)
        const at = Math.min(RexLambo.eqBars - 1, Math.max(0, ((minX + maxX) / 2 / W) * RexLambo.eqBars - 0.5));
        const band = Math.floor(at);
        const next = Math.min(band + 1, RexLambo.eqBars - 1);
        const t = at - band;
        // as a share of the building's whole visible body, so a full column lights it from foot to roof
        const T = h + RexLambo.eqBelow;
        const lvl = (this.eqLevel[band] * (1 - t) + this.eqLevel[next] * t) * T;
        const pk = (this.eqPeak[band] * (1 - t) + this.eqPeak[next] * t) * T;
        const m = RexLambo.eqCell; // every building's lights are the same size
        eqLights(false, x1, y0, b.d, h, lvl, pk, m);
        eqLights(true, y1, x0, b.w, h, lvl, pk, m);
      } else if (!this.musicOn) {
        // with the sound switched off the windows just flip at random, now and then
        lit(b.roadWin, false, x1, y0, h);
        lit(b.nearWin, true, y1, x0, h);
      }
      ctx.globalAlpha = 1;
    }
  }

  // Billboards run along the road from y0 (off to the left of the screen) to y1 (off to the right), measured in road blocks.
  // The car stops with a billboard at stopY. A new billboard starts gap blocks before that, so the gap is how far apart
  // consecutive billboards are, and how far the car drives between stops. y1 is far enough down the road that a billboard
  // has shrunk to a speck by then: the road runs on to its vanishing point, which on a wide window is well inside the view
  // (at 21 they were removed while they could still be seen). How far a billboard goes only changes how long it lives:
  // the stopping place and the spacing are in blocks.
  static y1 = -30;
  static stopY = 29.65;
  static gap = 7;
  static y0 = RexLambo.stopY + RexLambo.gap;
  static trip = RexLambo.y0 - RexLambo.y1; // blocks travelled over a billboard's whole life
  static stopAt = RexLambo.gap / RexLambo.trip; // how far along its life it is when the car stops

  /**
   * Puts a new billboard on the road, on the far side. p is how far along its trip it is: 0 is the start of the road,
   * 1 the far end, and below 0 is further back still, off the edge of the view, waiting its turn.
   */
  spawn(p = 0) {
    const world = this.shadowRoot.querySelector(".world");
    if (!world) return;
    this.billboardCount++;

    const board = document.createElement("div");
    board.className = "board";
    board.setAttribute("aria-hidden", "true"); // the sign's picture; what it says is in the panel
    RexLambo.place(board, p);

    // the billboards go round the entries in `tables` in order, so every sign belongs to a text panel
    const idx = (this.billboardCount - 1) % RexLambo.tables.length;
    const sign = document.createElement("div");
    sign.className = "sign";
    sign.appendChild(RexLambo.paint(idx % RexLambo.arts.length, this.avatarSrc));
    board.appendChild(sign);
    board.insertAdjacentHTML(
      "beforeend",
      '<div class="lamps"></div><div class="walk"></div><div class="brace"></div><div class="post a"></div><div class="post b"></div>',
    );

    world.appendChild(board);
    this.boards.push({ el: board, p, idx });
  }

  /**
   * Puts a billboard p of the way along its trip (the CSS has the same transform for p = 0). Writing the transform itself,
   * not a custom property it reads, means only this element's style changes, not its eight children's too.
   */
  static place(el, p) {
    el.style.transform = `translate3d(var(--x), calc(var(--y0) + (var(--y1) - var(--y0)) * ${p}), 0) rotateZ(90deg) rotateX(-90deg)`;
  }

  /* ---------- pixel art for the billboards: tiny canvases drawn at 64 x 32 and scaled up crisp ---------- */

  // 3 x 5 pixel font, one string of 15 bits per glyph, read row by row
  static font = {
    A: "010101111101101",
    B: "110101110101110",
    C: "011100100100011",
    D: "110101101101110",
    E: "111100110100111",
    F: "111100110100100",
    G: "011100101101011",
    H: "101101111101101",
    I: "111010010010111",
    J: "001001001101010",
    K: "101101110101101",
    L: "100100100100111",
    M: "101111111101101",
    N: "110101101101101",
    O: "010101101101010",
    P: "110101110100100",
    Q: "010101101111011",
    R: "110101110101101",
    S: "011100010001110",
    T: "111010010010010",
    U: "101101101101111",
    V: "101101101101010",
    W: "101101111111101",
    X: "101101010101101",
    Y: "101101010010010",
    Z: "111001010100111",
    0: "111101101101111",
    1: "010110010010111",
    2: "110001010100111",
    3: "110001010001110",
    4: "101101111001001",
    5: "111100110001110",
    6: "011100111101111",
    7: "111001010010010",
    8: "111101111101111",
    9: "111101111001110",
    "!": "010010010000010",
    "-": "000000111000000",
  };

  /** A canvas with str in the 3 x 5 pixel font and a drop shadow, to be scaled up crisp by the CSS. */
  static pixelText(str) {
    const s = str.toUpperCase();
    const cv = document.createElement("canvas");
    cv.width = s.length * 4; // 3 pixels a letter and 1 between, and 1 more for the shadow
    cv.height = 6;
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", str);
    RexLambo.text(cv.getContext("2d"), s, 0, 0, "#ffffff", "#c2207a");
    return cv;
  }

  static text(ctx, str, x, y, color, shadow) {
    let cx = x;
    for (const ch of str) {
      const g = RexLambo.font[ch];
      if (g) {
        // the drop shadow goes down first so every pixel of the glyph is painted over it
        if (shadow) {
          ctx.fillStyle = shadow;
          for (let i = 0; i < 15; i++)
            if (g[i] === "1")
              ctx.fillRect(cx + (i % 3) + 1, y + Math.floor(i / 3) + 1, 1, 1);
        }
        ctx.fillStyle = color;
        for (let i = 0; i < 15; i++)
          if (g[i] === "1")
            ctx.fillRect(cx + (i % 3), y + Math.floor(i / 3), 1, 1);
      }
      cx += 4;
    }
  }

  // x that centres a string on the 64 pixel wide canvas
  static mid(str) {
    return Math.floor((64 - (str.length * 4 - 1)) / 2);
  }

  // the photo for the profile billboard: set with the avatar attribute, "./me.jpg" by default (relative, so it works
  // under a GitHub Pages sub path). One Image is shared by every profile billboard that uses the same url.
  static avatarSrc = "./me.jpg";
  static avatar(src = RexLambo.avatarSrc) {
    RexLambo._avatars ??= new Map();
    let img = RexLambo._avatars.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      RexLambo._avatars.set(src, img);
    }
    return img;
  }

  // draws a sprite: one string per row, every "1" is a pixel
  static sprite(ctx, rows, x, y, color) {
    ctx.fillStyle = color;
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++)
        if (row[rx] === "1") ctx.fillRect(x + rx, y + ry, 1, 1);
    });
  }

  static arts = [
    // 0: retro video game character profile screen, built around the photo in public/me.jpg
    (c, avatarSrc) => {
      // backdrop: deep indigo with a faint checker, like the select screens of old
      for (let y = 0; y < 32; y += 2)
        for (let x = 0; x < 64; x += 2) {
          c.fillStyle = ((x + y) / 2) % 2 ? "#170a3a" : "#12082e";
          c.fillRect(x, y, 2, 2);
        }
      // title bar
      c.fillStyle = "#ff2e93";
      c.fillRect(0, 0, 64, 6);
      c.fillStyle = "#b3156b";
      c.fillRect(0, 5, 64, 1);
      RexLambo.text(
        c,
        "PLAYER 1",
        RexLambo.mid("PLAYER 1"),
        0,
        "#ffffff",
        "#7a1f6b",
      );
      // outer frame
      c.fillStyle = "#09c";
      c.fillRect(0, 31, 64, 1);
      c.fillRect(0, 6, 1, 26);
      c.fillRect(63, 6, 1, 26);

      // portrait frame: a gold border, a dark mat, and the photo inside
      c.fillStyle = "#fff3a8";
      c.fillRect(3, 7, 24, 24);
      c.fillStyle = "#c2410c";
      c.fillRect(4, 8, 22, 22);
      c.fillStyle = "#1a0b3d";
      c.fillRect(5, 9, 20, 20);
      // little corner studs
      c.fillStyle = "#ff8a5c";
      [
        [3, 7],
        [26, 7],
        [3, 30],
        [26, 30],
      ].forEach(([x, y]) => c.fillRect(x, y, 1, 1));

      // name, level and two stat bars on the right
      RexLambo.text(c, "NATHAN", 31, 8, "#7df3ff", "#005f7a");
      RexLambo.text(c, "LV 99", 31, 14, "#fff3a8", "#8a5a00");
      const bar = (y, label, fill, color) => {
        RexLambo.text(c, label, 31, y, "#ff4fa3");
        c.fillStyle = "#2b1b55";
        c.fillRect(44, y + 1, 18, 3);
        c.fillStyle = color;
        c.fillRect(44, y + 1, fill, 3);
        c.fillStyle = "rgba(255,255,255,0.35)";
        c.fillRect(44, y + 1, fill, 1);
      };
      bar(20, "STR", 15, "#ff4fa3");
      bar(26, "INT", 18, "#7df3ff");

      // the photo itself: shrunk to 20 x 20 so it turns into big chunky pixels, then given a neon duotone
      const img = RexLambo.avatar(avatarSrc);
      const paintPhoto = () => {
        const tmp = document.createElement("canvas");
        tmp.width = tmp.height = 20;
        const t = tmp.getContext("2d");
        t.imageSmoothingQuality = "high";
        t.drawImage(img, 0, 0, 20, 20);
        c.imageSmoothingEnabled = false;
        c.drawImage(tmp, 5, 9);
        // neon tint: pink from the top left to cyan at the bottom right
        const g = c.createLinearGradient(5, 9, 25, 29);
        g.addColorStop(0, "rgba(255, 46, 147, 0.28)");
        g.addColorStop(1, "rgba(0, 200, 255, 0.28)");
        c.globalCompositeOperation = "overlay";
        c.fillStyle = g;
        c.fillRect(5, 9, 20, 20);
        c.globalCompositeOperation = "source-over";
        // every other row a touch darker, for a CRT feel
        c.fillStyle = "rgba(0, 0, 0, 0.1)";
        for (let y = 10; y < 29; y += 2) c.fillRect(5, y, 20, 1);
      };
      if (img.complete && img.naturalWidth) paintPhoto();
      else img.addEventListener("load", paintPhoto, { once: true });
    },
    // 1: "LEET SKILLS": a hacker terminal with a faint rain of green code and three skill meters (HTML, CSS, JS) that
    // match the scores in the text panel
    (c) => {
      c.fillStyle = "#03120d";
      c.fillRect(0, 0, 64, 32);
      // faint falling code: short green streaks, brightest at the head, in a fixed pattern
      for (let x = 1; x < 64; x += 3) {
        const len = 4 + ((x * 7) % 9);
        const top = (x * 13) % 32;
        for (let i = 0; i < len; i++) {
          c.fillStyle = `rgba(60, 255, 120, ${(0.05 + (0.22 * i) / len).toFixed(3)})`;
          c.fillRect(x, (top + i) % 32, 1, 1);
        }
      }
      // frame and title bar
      c.fillStyle = "#0a3a2a";
      c.fillRect(0, 0, 64, 7);
      c.fillStyle = "#4dff9a";
      c.fillRect(0, 6, 64, 1);
      c.fillRect(0, 31, 64, 1);
      c.fillRect(0, 6, 1, 26);
      c.fillRect(63, 6, 1, 26);
      RexLambo.text(
        c,
        "LEET SKILLS",
        RexLambo.mid("LEET SKILLS"),
        1,
        "#eafff3",
        "#0b6b46",
      );
      // the meters: a label, a dark track and a coloured bar with a brighter top edge
      const meter = (y, label, fill, color) => {
        RexLambo.text(c, label, 4, y, "#4dff9a");
        c.fillStyle = "#0b2a22";
        c.fillRect(21, y, 39, 5);
        c.fillStyle = color;
        c.fillRect(21, y, fill, 5);
        c.fillStyle = "rgba(255, 255, 255, 0.4)";
        c.fillRect(21, y, fill, 1);
        // tick marks along the track, so it reads as a gauge
        c.fillStyle = "rgba(0, 0, 0, 0.35)";
        for (let x = 25; x < 60; x += 4) c.fillRect(x, y, 1, 5);
      };
      meter(10, "HTML", 39, "#ff7a45");
      meter(17, "CSS", 36, "#4da6ff");
      meter(24, "JS", 32, "#ffe14d");
    },
    // 2: "THE HUMAN": the three things in that section's score list, CYCL (cycling), YT (YouTube) and TVL (travel), each
    // as a little icon in its own framed panel
    (c) => {
      // backdrop: a dusk gradient in bands, with a few stars
      const dusk = ["#120a2e", "#1a0d3d", "#25104a", "#33145a"];
      dusk.forEach((col, i) => {
        c.fillStyle = col;
        c.fillRect(0, i * 8, 64, 8);
      });
      c.fillStyle = "rgba(255, 255, 255, 0.55)";
      [
        [10, 8],
        [31, 9],
        [52, 8],
      ].forEach(([x, y]) => c.fillRect(x, y, 1, 1));
      // title bar
      c.fillStyle = "#ff7a45";
      c.fillRect(0, 0, 64, 7);
      c.fillStyle = "#b8431f";
      c.fillRect(0, 6, 64, 1);
      RexLambo.text(
        c,
        "THE HUMAN",
        RexLambo.mid("THE HUMAN"),
        1,
        "#fff8e0",
        "#8a2f10",
      );
      // three framed panels, each with an icon above its label
      const panel = (x, border, label) => {
        c.fillStyle = border;
        c.fillRect(x, 9, 18, 22);
        c.fillStyle = "#150a35";
        c.fillRect(x + 1, 10, 16, 20);
        RexLambo.text(
          c,
          label,
          x + Math.floor((18 - (label.length * 4 - 1)) / 2),
          24,
          "#fff3a8",
          "#5a3300",
        );
      };

      // cycling: a bicycle, wheels and frame
      panel(2, "#4dff9a", "CYCL");
      RexLambo.sprite(
        c,
        [
          "....111...11...",
          ".....111111....",
          "..111.....111..",
          ".1...11..11..1.",
          "1.....111..1..1",
          "1..111111..1..1",
          "1.....1.1.....1",
          ".1...1...1...1.",
          "..111.....111..",
        ],
        3,
        12,
        "#4dff9a",
      );

      // YouTube: a red screen with a white play triangle
      panel(23, "#ff4f4f", "YT");
      c.fillStyle = "#ff1a1a";
      c.fillRect(26, 13, 12, 8);
      c.fillRect(25, 14, 14, 6);
      c.fillStyle = "#ffffff";
      [1, 2, 3, 2, 1].forEach((w, i) => c.fillRect(30, 14 + i, w, 1));

      // travel: a globe with a few continents and a highlight
      panel(44, "#4da6ff", "TVL");
      const gx = 53;
      const gy = 16;
      for (let y = -5; y <= 5; y++)
        for (let x = -5; x <= 5; x++) {
          const d = x * x + y * y;
          if (d > 28) continue;
          c.fillStyle = d > 21 ? "#1f6fbf" : "#2f8fe8";
          c.fillRect(gx + x - 0, gy + y - 0, 1, 1);
        }
      c.fillStyle = "#4dd36a";
      [
        [-3, -3, 3, 2],
        [-4, -1, 2, 3],
        [1, -1, 3, 3],
        [2, 2, 2, 2],
      ].forEach(([x, y, w, h]) => c.fillRect(gx + x, gy + y, w, h));
      c.fillStyle = "rgba(255, 255, 255, 0.6)";
      c.fillRect(gx - 3, gy - 4, 2, 1);
      c.fillRect(gx - 4, gy - 3, 1, 1);
    },
  ];

  static paint(index, avatarSrc) {
    const art = document.createElement("canvas");
    art.width = 64;
    art.height = 32;
    const ctx = art.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    RexLambo.arts[index](ctx, avatarSrc);
    // What is shown is the art blown up 8 times, with the scanlines and the faint glare drawn into the same picture. As a
    // layer over the sign they were sometimes drawn a moment after the sign came into view (at 4K), and popped in.
    const cv = document.createElement("canvas");
    cv.width = 64 * 8;
    cv.height = 32 * 8;
    const out = cv.getContext("2d");
    const compose = () => {
      const W = cv.width;
      const H = cv.height;
      out.setTransform(1, 0, 0, 1, 0, 0);
      out.imageSmoothingEnabled = false;
      out.drawImage(art, 0, 0, W, H);
      // scanlines: a dark line a third of every 6 pixels (0.9cqw on the sign, as they were)
      out.fillStyle = "rgba(0, 0, 0, 0.2)";
      for (let y = 0; y < H; y += 6) out.fillRect(0, y, W, 2);
      // the glare, from the top left at 115 degrees; the canvas is shown mirrored (see .sign canvas), so it is drawn mirrored
      out.setTransform(-1, 0, 0, 1, W, 0);
      const a = (115 * Math.PI) / 180;
      const dx = Math.sin(a);
      const dy = -Math.cos(a);
      const len = Math.abs(W * dx) + Math.abs(H * dy);
      const g = out.createLinearGradient(W / 2 - (dx * len) / 2, H / 2 - (dy * len) / 2, W / 2 + (dx * len) / 2, H / 2 + (dy * len) / 2);
      g.addColorStop(0, "rgba(255, 255, 255, 0.14)");
      g.addColorStop(0.28, "rgba(255, 255, 255, 0.04)");
      g.addColorStop(0.4, "rgba(255, 255, 255, 0)");
      out.fillStyle = g;
      out.fillRect(0, 0, W, H);
    };
    compose();
    // the photo billboard draws its photo when it has loaded (after the art's own listener, so this comes second)
    const img = RexLambo._avatars?.get(avatarSrc);
    if (img && !(img.complete && img.naturalWidth)) img.addEventListener("load", compose, { once: true });
    return cv;
  }

  applyState() {
    const stage = this.shadowRoot.querySelector(".stage");
    if (!stage) return;
    const speed = (this.speedValue = this.speed);
    this.frozen = this.hasAttribute("paused"); // (tick reads these every frame, so they are kept rather than looked up)
    stage.style.setProperty("--spin", `${speed}s`);
    stage.style.setProperty("--road", `${speed * RexLambo.roadPerSpin}s`);
    stage.classList.toggle("paused", this.hasAttribute("paused"));
  }

  render() {
    const src = this.getAttribute("src") || RexLambo.defaultSrc;
    // five big holes and five bolts round the hub, each turned by its own --a
    const ring = (tag, first) =>
      [0, 72, 144, 216, 288]
        .map((a) => `<${tag} style="--a:${a + first}deg"></${tag}>`)
        .join("");
    // the progress strip's mini billboards, one for each table, spaced evenly between START and the finish line
    const stops = RexLambo.tables
      .map(
        (t, i) =>
          `<button type="button" class="stop" style="--at:${(i + 1) / (RexLambo.tables.length + 1)}" aria-label="Drive to ${RexLambo.esc(t.title)}"><b></b></button>`,
      )
      .join("");
    // a piece starts barrierBlocks blocks after the one before; a block is 76cqw and the patterns repeat every 48cqw, so the
    // pieces are given the shift (--off) that makes their patterns join up
    const barrier = Array.from(
      { length: RexLambo.barrierPieces },
      (_, i) =>
        `<div class="barrier" style="--i:${i};--off:${-((RexLambo.barrierBlocks * i * 76) % 48)}cqw"><div class="lid"></div><div class="rail"></div></div>`,
    ).join("");
    const roadTiles = Array.from(
      { length: RexLambo.roadTiles },
      (_, i) => `<div class="plane" style="--j:${i}"></div>`,
    ).join("");
    const spokes = ring("b", 0);
    const bolts = ring("i", 36);
    const wheels = RexLambo.wheels
      .map(
        (w) => `
        <div class="wheel ${w.name}"
             style="left:${w.x}%; top:${w.y}%; height:${w.h}%; --k:${w.k}; --tilt:${w.tilt}deg">
          <div class="rim">
            <div class="dish">
              <div class="spin">
                ${spokes}
                <div class="hub"></div>
                ${bolts}
              </div>
              <div class="shade"></div>
            </div>
          </div>
        </div>`,
      )
      .join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; background:black}
        /*
         * the fill attribute: run full screen, not in a box. The component fills whatever box it is given (give it
         * position: fixed; inset: 0 for the whole window). The stage fills that box, with square corners. The scene is laid
         * out in units of its width, so the layout (the .view) is never wider than 1.6 times the height, or the top of the
         * moon and the billboard would be pushed out of view; on a wider window the .view is centred and the sky, the road,
         * the barrier and the skyline carry on past both its sides to the edges of the box.
         */
        /* a finger moving sideways is a swipe for the car, not a scroll of the page (up and down still scrolls it) */
        .stage, .table { touch-action: pan-y pinch-zoom; }
        /* only for screen readers (the live region) */
        .sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
        /* the component can be tabbed to: a ring just inside its edge */
        :host(:focus-visible) { outline: 0.2rem solid #fff3a8; outline-offset: -0.2rem; }
        .table:focus-visible { outline: 0.15em solid #fff3a8; outline-offset: 0.45em; }
        :host([fill]) { width: 100%; height: 100%; container-type: size; }
        :host([fill]) .stage { aspect-ratio: auto; min-height: 0; height: 100%; width: 100%; border-radius: 0; container-type: normal; --dw: min(100cqw, 160cqh); }
        .stage {
          --spin: ${RexLambo.defaultSpeed}s;
          --road: ${RexLambo.defaultSpeed * RexLambo.roadPerSpin}s;
          --dw: 100cqw; /* the width of the .view, the 16:10 layout (see :host([fill]) .stage, where it is worked out from the height) */
          --car: 30cqw;
          /* font sizes of the controls (top left) and the progress strip (bottom left), shared so the text panel can sit between them */
          --ctl: max(0.8rem, 1.2cqw);
          --trk: max(0.75rem, 1.05cqw); /* at least 12px, so a mini billboard (2.2em) is bigger than 24px */
          --tbl: clamp(0.8rem, 1.9cqw, 0.95rem); /* the text panel's font size on a narrow stage */
          --pad: max(3cqw, 1rem); /* the gap between things on a narrow stage (see the container query on .table): 3% of the width, at least 16px */
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          min-height: 28rem;
          border-radius: var(--borderRadius, 0.5rem);
          overflow: hidden;
          container-type: inline-size;
        }
        /* the layout box: 16:10 and centred, holding the car, the road, the text panel and the controls, all sized in its own cqw.
           The sky, the moon and the skyline are outside it and run the full width of the stage, so on a wide window the scene
           carries on past both sides of the view instead of ending there. */
        .view { position: absolute; top: 0; bottom: 0; left: 0; right: 0; margin: 0 auto; width: var(--dw); container-type: inline-size; }
        /* the car, wheels and road live in a box --car wide (30% of the stage); the road runs on out past it and is cut off by the edge of the view */
        .scene {
          position: absolute;
          right: 10cqw;
          bottom: 9cqw;
          width: var(--car);
          aspect-ratio: 1408 / 768;
          container-type: inline-size;
        }
        /*
         * ambient occlusion under the car: the ground right beneath a car gets very little light, so it is darkest
         * under the body and in a tight contact patch under each tyre, and fades out softly over the road around it.
         * Four layered gradient ellipses drawn between the road and the car image, set along the car's own
         * direction (about -16 degrees: it rises to the right as it recedes). The sizes are % of the car image.
         */
        .ao { position: absolute; inset: 0; pointer-events: none; }
        .ao i { position: absolute; border-radius: 50%; transform-origin: 50% 50%; }
        /* a wide, faint pool of shade all round the car */
        .ao .long {
          left: 6%; top: 62%; width: 94%; height: 30%;
          transform: rotate(-16deg);
          background: radial-gradient(ellipse at center, rgba(8, 0, 24, 0.3) 0, rgba(8, 0, 24, 0.14) 40%, transparent 78%);
        }
        /* a darker, tighter core under the body itself */
        .ao .body {
          left: 13%; top: 67%; width: 80%; height: 19%;
          transform: rotate(-16deg);
          background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.42) 0, rgba(0, 0, 0, 0.22) 50%, transparent 85%);
        }
        /* contact shadow where each tyre meets the road: the darkest, sharpest spots */
        .ao .fw {
          left: 47%; top: 85%; width: 22%; height: 9%;
          transform: rotate(-16deg);
          background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.5) 0, rgba(0, 0, 0, 0.3) 40%, transparent 80%);
        }
        .ao .rw {
          left: 81.5%; top: 66%; width: 16%; height: 7%;
          transform: rotate(-16deg);
          background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.5) 0, rgba(0, 0, 0, 0.3) 40%, transparent 80%);
        }
        img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
          user-select: none;
          -webkit-user-drag: none;
        }
        /* the wheel box is a square sized from the stage height, then squashed into an ellipse */
        .wheel {
          position: absolute;
          aspect-ratio: 1;
          transform: translate(-50%, -50%) rotate(var(--tilt)) scaleX(var(--k));
        }
        /* outer lip of the rim: bright metal edge, then a dark gap before the dish */
        .rim {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background:
            radial-gradient(circle at 66% 70%, #cfd4dc 0, #8c929d 60%, #4a505b 100%);
          box-shadow: inset 0 0 0 2px #14161b;
          overflow: hidden;
        }
        .rim::before {
          content: "";
          position: absolute;
          inset: 5%;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 36%, #0d0f15 0 70%, #2b313c 100%);
        }
        /* the recessed dish: dark top left, lit bottom right, like a concave bowl */
        .dish {
          position: absolute;
          inset: 8%;
          border-radius: 50%;
          overflow: hidden;
          background: radial-gradient(circle at 66% 70%, #d3d8de 0, #9ba1ab 45%, #4b515d 85%, #2a2f39 100%);
          box-shadow: inset 0 0 0 1px #20242c;
        }
        .spin {
          position: absolute;
          inset: 0;
          animation: spin var(--spin) linear infinite;
        }
        .paused .spin { animation-play-state: paused; }
        /* five big dark holes, each with a faint bright edge on its lower right */
        .spin b {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 25%;
          height: 25%;
          margin: -12.5%;
          transform: rotate(var(--a)) translateY(-125%);
          border-radius: 50%;
          background: radial-gradient(circle at 38% 34%, #000 0 55%, #0c0f18 75%, #5a6170 92%, #9aa1ae 100%);
        }
        .hub {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 15%;
          height: 15%;
          margin: -7.5%;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 38%, #1a1d26 0 45%, #5d6470 70%, #aab0ba 100%);
          box-shadow: 0 0 0 2px #2e333d;
        }
        /* little bolts around the hub */
        .spin i {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 4.5%;
          height: 4.5%;
          margin: -2.25%;
          transform: rotate(var(--a)) translateY(-300%);
          border-radius: 50%;
          background: #6b727e;
          box-shadow: 0 0 0 1px #14161b;
        }
        /* lighting that stays put while the wheel turns, so it reads as a bowl not a flat disc */
        .shade {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          pointer-events: none;
          background:
            radial-gradient(circle at 28% 24%, rgba(0, 0, 0, 0.45), transparent 55%),
            radial-gradient(circle at 70% 74%, rgba(255, 255, 255, 0.22), transparent 45%);
        }
        .shade::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          box-shadow: inset 0.35em 0.3em 0.5em rgba(0, 0, 0, 0.55), inset -0.15em -0.15em 0.3em rgba(255, 255, 255, 0.3);
        }
        @keyframes spin { to { transform: rotate(-360deg); } }

        /*
         * the sky: black at the top deepening to purple at the horizon, with the stars on it. It runs from the top of
         * the stage down to the horizon (22cqw above the bottom), and below that the ground fades from purple back to
         * black, so the horizon reads as a glow. Behind it all is the stage's black.
         */
        .sky {
          position: absolute;
          inset: 0 0 calc(var(--dw) * 0.22) 0;
          background: linear-gradient(to bottom, #000 0%, #07011a 30%, #1a0540 65%, #3b0f78 100%);
          pointer-events: none;
        }
        .sky::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: 100%;
          height: calc(var(--dw) * 0.22);
          background: linear-gradient(to bottom, #3b0f78 0%, #14042c 35%, #000 100%);
        }
        .sky .stars { position: absolute; inset: 0; width: 100%; height: 100%; }
        /*
         * the moon, far behind everything: a big disc fading from yellow through orange to hot pink, with
         * the horizontal slits cut across its lower half that retrowave suns and moons always have, and a
         * soft halo. It is anchored to the bottom of the stage, where the horizon is, so it sits just above
         * the skyline and shows through the wireframe buildings. The halo is a separate layer because a mask
         * would clip any glow put on the disc itself.
         */
        .moon {
          position: absolute;
          left: calc(50% + var(--dw) * 0.07);
          bottom: calc(var(--dw) * 0.29);
          width: calc(var(--dw) * 0.28);
          aspect-ratio: 1;
          pointer-events: none;
        }
        .moon::before {
          content: "";
          position: absolute;
          inset: -32%;
          background: radial-gradient(circle, rgba(255, 70, 170, 0.4) 0 30%, rgba(255, 160, 70, 0.16) 46%, transparent 68%);
        }
        .moon::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: linear-gradient(to bottom, #fff08a 0%, #ffc55a 24%, #ff8a5c 46%, #ff4f9a 68%, #c0288f 100%);
          -webkit-mask: linear-gradient(to bottom, #000 0 50%, transparent 50% 53%, #000 53% 58%, transparent 58% 62%, #000 62% 67.5%, transparent 67.5% 72%, #000 72% 78.5%, transparent 78.5% 83.5%, #000 83.5% 90%, transparent 90% 96%, #000 96%);
                  mask: linear-gradient(to bottom, #000 0 50%, transparent 50% 53%, #000 53% 58%, transparent 58% 62%, #000 62% 67.5%, transparent 67.5% 72%, #000 72% 78.5%, transparent 78.5% 83.5%, #000 83.5% 90%, transparent 90% 96%, #000 96%);
        }
        /*
         * the road: a long flat strip tilted back with rotateX so the browser's own perspective
         * does the foreshortening. rotateZ first turns it to run along the car, then rotateX lays
         * it down. perspective-origin sits on the plane's centre so the car stays over the road.
         * Sizes use cqw (1% of the stage width) so everything scales with the component.
         */
        .road {
          --w: 76cqw;
          /* extra road on the camera side, so it fills the bottom right corner of the view. It is a big layer that is repainted
             every frame while driving, so it is only made wider (by --ex, how much wider the stage is than the view, set in
             startCity) on a window that is wider than the view; made wide for everyone it made the track box flicker. */
          --wx: calc(120cqw + 130cqw * var(--ex, 0));
          position: absolute;
          inset: 0;
          perspective: ${RexLambo.perspective}cqw;
          perspective-origin: 52% 62%;
          pointer-events: none;
        }
        /* the road is one block wide; each block is --w long, so every section is one big square */
        .ground {
          position: absolute;
          left: 52%;
          top: 62%;
          width: calc(var(--w) + var(--wx));
          height: calc(var(--w) * 60);
          transform: translate(-50%, -50%) rotateX(70deg) rotateZ(42deg) translateX(calc(var(--wx) / 2));
          transform-style: preserve-3d;
        }
        /* the ground is cut into tiles, since one layer taller than the GPU's largest texture (16384px) is not drawn at all */
        .plane {
          position: absolute;
          left: 0;
          width: 100%;
          top: calc(var(--w) * ${RexLambo.roadTileBlocks} * var(--j));
          height: calc(var(--w) * ${RexLambo.roadTileBlocks} + 0.3cqw); /* a hair longer than the tile, with the same pattern, so no seam shows */
          transform: translateZ(0);
          box-sizing: border-box;
          background-color: #2b2b2b;
          background-image: linear-gradient(#09c 0 0.5cqw, transparent 0.5cqw);
          background-size: 100% var(--w);
          border-left: 0.7cqw solid #09c;
          border-right: 0.7cqw solid #09c;
          animation: drive var(--road) linear infinite;
        }
        /* one block per loop, so the pattern repeats seamlessly. Moves the ground rear-ward. */
        @keyframes drive { to { background-position: 0 calc(var(--w) * -1); } }
        .paused .plane, .paused .barrier, .paused .lid, .paused .rail { animation-play-state: paused; }
        /*
         * the high score table that fades in at each stop: an arcade style panel (dark screen, notched neon frame, a
         * glowing title, a short score list) that holds a few paragraphs of text. It fills the right of the stage from
         * top to bottom: 46% wide, and 3% in from the right edge, 4% down from the top and 4% up from the bottom, the
         * same spacing to the edge as the progress strip has (so it may cover the car). It scrolls when the text is longer than the
         * space, and only takes the pointer while shown, so it can be scrolled.
         */
        .table {
          position: absolute;
          right: 3%;
          top: calc(2.5% + 2.6 * var(--ctl) + 1.6cqw); /* below the VIBE MODE switch */
          bottom: 4%;
          width: 46%;
          overflow-y: auto;
          overflow-x: hidden;
          overscroll-behavior: contain;
          scrollbar-width: thin;
          scrollbar-color: #09c rgba(8, 2, 30, 0.9);
          box-sizing: border-box;
          padding: 1.4em 1.6em 1.1em;
          font: 400 clamp(0.8rem, 1.3cqw, 1.05rem) / 1.65 ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace;
          color: #d9e8ff;
          background:
            repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 3px),
            rgba(8, 2, 30, 0.9);
          /* a notched frame like an old pixel border: four offset lines leave the corners cut out */
          box-shadow:
            0 -0.3em 0 0 #09c, 0 0.3em 0 0 #09c, -0.3em 0 0 0 #09c, 0.3em 0 0 0 #09c,
            0 0 1.6em 0.3em rgba(0, 153, 204, 0.45),
            inset 0 0 2.4em rgba(255, 46, 147, 0.18);
          opacity: 0;
          transform: translateY(0.8em);
          transition: opacity 0.7s ease-out, transform 0.7s ease-out;
          pointer-events: none;
        }
        .stage.table-on .table { opacity: 1; transform: none; transition-delay: 0.35s; pointer-events: auto; }
        /*
         * Narrow stages (1100px wide or less, the compact layout): the text panel
         * takes the full width, under the TURBO and sound controls and down to the progress strip, with the same gap (3% of
         * the width) at the top and the bottom as the panel has to the edges. The controls are 2.6em high; the strip is 5.8em in the wide layout and 2.65em here, without its box and labels, flush with the bottom edge.
         */
        @container (max-width: 1100px) {
          /* one gap (--pad) for everything: the controls and the panel from the edges, and the panel from the controls and the strip */
          .stage .controls, .stage:not(.intro) .hint { left: var(--pad); top: var(--pad); }
          .stage .vibe { right: var(--pad); top: var(--pad); }
        }
        @container (max-width: 640px) {
          .stage .vibe { gap: 0.6em; padding: 0.6em 0.7em; letter-spacing: 0.1em; }
        }
        @container (max-width: 1100px) {
          /* the progress strip loses its box and its START and FINISH labels, and stretches across the whole width, flush
             with the bottom edge. Its two ends line up with the visible edges of the text panel above it: the panel's frame
             is drawn 0.3em (of the panel's font) outside its box, the finish line reaches 0.5em and the flag 0.09em (of the
             strip's font) past the two ends of the course, so the padding makes up the difference. */
          .stage .track {
            left: 0;
            right: 0;
            bottom: 0; /* right at the bottom edge: the dashed road (0.35em up inside the course) is pulled down to it below */
            width: auto;
            min-width: 0;
            padding: 0 calc(var(--pad) - 0.3 * var(--tbl) + 0.09 * var(--trk)) 0 calc(var(--pad) - 0.3 * var(--tbl) + 0.5 * var(--trk));
            background: none;
            box-shadow: none;
          }
          /* the little car (4.8em wide) is centred on its place exactly as before, so it stops level with the mini billboards, but it
             is held 2.4em in from the two ends, so it never sticks out past the panel's edges while it passes the flag or the finish */
          .stage .course > .me { left: clamp(2.4em, calc((1 - var(--at, 0)) * 100%), calc(100% - 2.4em)); }          .stage .course { margin-bottom: -0.35em; }
          .stage .mark.start::after, .stage .mark.finish::after { content: none; }
          .table {
            left: var(--pad);
            right: var(--pad);
            width: auto;
            top: calc(var(--pad) + 2.6 * var(--ctl) + var(--pad));
            bottom: calc(2.65 * var(--trk) + var(--pad)); /* the strip is just its course here, 3em less the 0.35em pulled below its bottom, and it touches the edge */
            font-size: var(--tbl); /* small, because the height (not the width) is what is short here */
            padding: 1.2em 1.4em 1em;
          }
        }
        .table h2 {
          margin: 0;
          text-align: center;
          font-size: 1.9em;
          letter-spacing: 0.18em;
          color: #fff3a8;
          text-shadow: 0 0 0.3em #ffb347, 0 0.08em 0 #c2410c, 0 0 1em rgba(255, 140, 0, 0.7);
        }
        .table .sub {
          margin: 0.2em 0 0.9em;
          text-align: center;
          letter-spacing: 0.5em;
          color: #ff4fa3;
          text-shadow: 0 0 0.6em rgba(255, 46, 147, 0.8);
        }
        .table ol {
          list-style: none;
          margin: 0 0 1.2em;
          padding: 0.7em 1em;
          border-top: 0.15em dashed rgba(0, 200, 255, 0.5);
          border-bottom: 0.15em dashed rgba(0, 200, 255, 0.5);
        }
        .table li { display: flex; justify-content: space-between; letter-spacing: 0.2em; }
        .table li span:first-child { color: #ff4fa3; width: 3.5em; }
        .table li span:nth-child(2) { color: #7df3ff; flex: 1; }
        .table li span:last-child { color: #fff3a8; }
        .table p { margin: 0 0 0.9em; text-align: justify; hyphens: auto; white-space: pre-line; }
        .table p:last-child { margin-bottom: 0; }
        /* embedded media: full width of the panel, in a thin neon frame, with the subtitle centred underneath */
        .table .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(12em, 1fr)); gap: 1.4em 1.2em; margin-top: 1.2em; }
        .table .gallery.one { grid-template-columns: 1fr; }
        .table .media { margin: 0; text-align: center; min-width: 0; }
        /* every thumbnail is the same shape and size: cropped to fill, since the popup shows the whole picture */
        .table .gallery:not(.one) .media img, .table .gallery:not(.one) .media video { aspect-ratio: 4 / 3; object-fit: cover; }
        .table .gallery .media:has(audio) { grid-column: 1 / -1; }
        .table .media img, .table .media video { position: static; inset: auto; display: block; width: 100%; height: auto; box-sizing: border-box; border: 0.15em solid rgba(0, 200, 255, 0.6); box-shadow: 0 0 1em rgba(0, 153, 204, 0.4); background: #000; }
        .table .media audio { width: 100%; }
        .table .media .open { position: relative; display: block; width: 100%; margin: 0; padding: 0; border: 0; background: none; font: inherit; cursor: zoom-in; }
        .table .media .open:focus-visible { outline: 0.15em solid #ff4fa3; outline-offset: 0.2em; }
        /* a play badge over a video's first frame */
        .table .media .open.video::after {
          content: "\\25B6\\FE0E";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 2.6em;
          height: 2.6em;
          margin: -1.3em 0 0 -1.3em;
          display: grid;
          place-items: center;
          padding-left: 0.2em;
          box-sizing: border-box;
          border-radius: 50%;
          color: #fff;
          background: rgba(255, 46, 147, 0.75);
          box-shadow: 0 0 1em rgba(255, 46, 147, 0.7);
          pointer-events: none;
        }
        /*
         * the popup for a clicked image or video: a modal <dialog> (it goes in the browser's top layer, so it covers the
         * whole page, not just the stage) that fills the window with a dark backdrop and keeps the media inside about
         * 92% of the window width and 84% of its height, with the subtitle underneath and a close button top right.
         */
        .viewer {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          max-width: none;
          max-height: none;
          margin: 0;
          padding: 0;
          border: 0;
          background: rgba(4, 0, 16, 0.92);
          color: #d9e8ff;
          font: 400 clamp(0.8rem, 1.6vw, 1.1rem) / 1.5 ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace;
          cursor: zoom-out;
        }
        .viewer[open] { display: flex; align-items: center; justify-content: center; }
        .viewer::backdrop { background: rgba(4, 0, 16, 0.6); }
        .viewer .box { display: flex; flex-direction: column; align-items: center; gap: 0.8em; max-width: 92vw; cursor: default; }
        .viewer img, .viewer video {
          position: static;
          inset: auto;
          display: block;
          /* as big as fits in 92vw x 84vh at its own shape (--ar, set once its size is known), so small media is scaled up */
          width: min(92vw, calc(84vh * var(--ar, 1.7778)));
          height: auto;
          aspect-ratio: var(--ar, 16 / 9);
          object-fit: contain;
          box-sizing: border-box;
          border: 0.15em solid rgba(0, 200, 255, 0.7);
          box-shadow: 0 0 2em rgba(0, 153, 204, 0.5);
          background: #000;
          cursor: default;
        }
        .viewer .caption { text-align: center; letter-spacing: 0.12em; color: #7df3ff; text-shadow: 0 0 0.6em rgba(0, 200, 255, 0.5); }
        .viewer .x {
          position: absolute;
          top: 1.2vh;
          right: 1.2vw;
          width: 2.4em;
          height: 2.4em;
          padding: 0;
          font: inherit;
          font-size: 1.4em;
          line-height: 1;
          color: #fff3a8;
          background: rgba(255, 46, 147, 0.25);
          border: 0.1em solid #ff4fa3;
          cursor: pointer;
        }
        .viewer .x:hover, .viewer .x:focus-visible { background: rgba(255, 46, 147, 0.6); }
        .viewer .x:focus-visible { outline: 0.15rem solid #fff3a8; outline-offset: 0.15rem; }
        .table .media figcaption { margin-top: 0.6em; font-size: 0.85em; letter-spacing: 0.12em; color: #7df3ff; }
        /* download buttons: a row under the text, arcade style with a neon edge that lights up on hover or focus */
        .table .links { display: flex; flex-wrap: wrap; justify-content: center; gap: 1.2em; margin-top: 1.2em; padding: 0.3em 0.3em 1em; }
        /* every button is the same width (and the same height as the others on its row), whatever its label */
        .table .btn {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 min(17em, 100%);
          box-sizing: border-box;
          text-align: center;
          padding: 0.55em 1.4em;
          font: inherit;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-decoration: none;
          white-space: normal;
          color: #fff3a8;
          background: rgba(255, 46, 147, 0.18);
          box-shadow: 0 -0.2em 0 0 #ff4fa3, 0 0.2em 0 0 #ff4fa3, -0.2em 0 0 0 #ff4fa3, 0.2em 0 0 0 #ff4fa3, 0 0 1em rgba(255, 46, 147, 0.5);
          cursor: pointer;
        }
        .table .btn::before { content: "\\2B07\\FE0E"; margin-right: 0.7em; }
        /* the YouTube logo (a red rounded screen with a white play triangle) in place of the arrow, as an inline SVG */
        .table .btn.yt::before {
          content: "";
          display: inline-block;
          width: 1.5em;
          height: 1.05em;
          margin-right: 0.7em;
          vertical-align: -0.2em;
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 20'%3E%3Crect width='28' height='20' rx='5.5' fill='%23ff0033'/%3E%3Cpath d='M11 5.2v9.6l8.4-4.8z' fill='%23fff'/%3E%3C/svg%3E") center / contain no-repeat;
        }
        .table .btn:hover, .table .btn:focus-visible { color: #fff; background: rgba(255, 46, 147, 0.5); }
        .table .btn:focus-visible { outline: 0.15em solid #fff3a8; outline-offset: 0.2em; }
        .table .btn:active { transform: translateY(0.1em); }
        @media (prefers-reduced-motion: reduce) { .table { transition: opacity 0.2s; transform: none; } .stage.prompt .hint, .mark.finish.flash { animation: none; } }
        .hint {
          position: absolute;
          left: 3%;
          top: 2.5%;
          width: 46%;
          text-align: left;
          font-size: max(0.8rem, 1.7cqw); /* the text runs about 45% of the stage wide, so it scales with the stage */
          line-height: 1.3;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #fbeaff;
          text-shadow: 0 0 0.5em #ff2e93, 0 0 1.4em rgba(255, 46, 147, 0.6);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.6s;
        }
        /* blinks until the player presses to start (which removes the prompt), but not with reduced motion (see below). It is a slow fade, not a flash. */
        .stage.prompt .hint { opacity: 1; animation: blink 1.6s ease-in-out infinite; }
        /* the first screen, before the car has ever set off: the hint is a big INSERT COIN in the middle of the stage */
        .stage.intro .hint {
          left: 50%;
          right: auto;
          top: 50%;
          width: max-content;
          max-width: 90%;
          transform: translate(-50%, -50%);
          font-size: 0;
          line-height: 0;
        }
        /* the pixel font canvas, scaled up crisp (each pixel of the font is about 0.8% of the stage wide) with a neon glow */
        .hint canvas {
          display: block;
          width: max(34cqw, 14rem);
          max-width: 100%;
          height: auto;
          image-rendering: pixelated;
          filter: drop-shadow(0 0 0.6rem rgba(255, 46, 147, 0.85));
        }
        /*
         * the progress strip: bottom left (3% in from the edge, like the hint text above), a little way up from the edge. A dashed road from START (right) to a checkered
         * finish line (left) with a mini billboard for each stop, and a little car that follows the real one (see updateTrack).
         * Everything is sized in em from the strip's own font size, which follows the stage width. Positions along the
         * road are --at, from 0 (START, at the right) to 1 (the finish line, at the left), the way the car drives.
         */
        .track {
          position: absolute;
          left: 3%;
          bottom: 4%;
          width: 36%;
          min-width: 17em;
          box-sizing: border-box;
          padding: 0.9em 3em 1.9em; /* 3em at the sides: the car (4.8em wide) is centred on START and FINISH, so it needs 2.4em plus a little room to stay inside the border */
          font-size: var(--trk);
          background: rgba(8, 2, 30, 0.78);
          box-shadow: 0 -0.2em 0 0 #09c, 0 0.2em 0 0 #09c, -0.2em 0 0 0 #09c, 0.2em 0 0 0 #09c, 0 0 1.2em rgba(0, 153, 204, 0.45);
          pointer-events: none;
        }
        /*
         * the TURBO switch, top left (where the hint text is on the first screen): a label and an arcade style slider.
         * On, it glows orange and the car goes twice as fast. Hidden on the INSERT COIN screen like the strip below.
         */
        .controls { position: absolute; left: 3%; top: 2.5%; display: flex; gap: 1.6em; font-size: var(--ctl); transition: opacity 0.6s; }
        .stage.intro .controls { opacity: 0; pointer-events: none; }
        .turbo, .sound, .vibe {
          display: flex;
          align-items: center;
          gap: 0.9em;
          box-sizing: border-box;
          margin: 0;
          padding: 0.6em 1em;
          font: 700 1em / 1 ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace;
          letter-spacing: 0.2em;
          color: #fbeaff;
          background: rgba(8, 2, 30, 0.78);
          border: 0;
          cursor: pointer;
          box-shadow: 0 -0.2em 0 0 #09c, 0 0.2em 0 0 #09c, -0.2em 0 0 0 #09c, 0.2em 0 0 0 #09c, 0 0 1.2em rgba(0, 153, 204, 0.45);
          transition: opacity 0.6s, color 0.2s, box-shadow 0.2s;
        }
        .turbo:focus-visible, .sound:focus-visible, .vibe:focus-visible { outline: 0.15em solid #fff3a8; outline-offset: 0.45em; }
        .sound { padding: 0.6em 0.8em; }
        .sound svg { display: block; width: 2.2em; height: 1.4em; fill: #8d93a0; stroke: #8d93a0; stroke-width: 2; stroke-linecap: round; transition: fill 0.2s, stroke 0.2s; }
        .sound .spk { stroke-linejoin: round; }
        .sound .wave, .sound .off { fill: none; }
        .sound .off { stroke: #ff4f4f; }
        .sound[aria-checked="true"] svg { fill: #7df3ff; stroke: #7df3ff; }
        .sound[aria-checked="true"] .off, .sound[aria-checked="false"] .wave { display: none; }
        .turbo .sw, .vibe .sw { position: relative; width: 2.8em; height: 1.4em; box-sizing: border-box; border: 0.15em solid #7a7a96; background: #1d1d28; transition: border-color 0.2s, background 0.2s; }
        .turbo .sw i, .vibe .sw i { position: absolute; top: 0.1em; left: 0.1em; width: 0.9em; height: 0.9em; background: #8d93a0; transition: transform 0.2s, background 0.2s, box-shadow 0.2s; }
        .turbo[aria-checked="true"] {
          color: #fff3a8;
          box-shadow: 0 -0.2em 0 0 #ff7a45, 0 0.2em 0 0 #ff7a45, -0.2em 0 0 0 #ff7a45, 0.2em 0 0 0 #ff7a45, 0 0 1.4em rgba(255, 122, 69, 0.7);
        }
        .turbo[aria-checked="true"] .sw { border-color: #ff7a45; background: #5a1f10; }
        .turbo[aria-checked="true"] .sw i { transform: translateX(1.4em); background: #ffb347; box-shadow: 0 0 0.7em #ff7a45; }
        /*
         * VIBE MODE: top right, always there (the text panel sits below it). Neon magenta where TURBO is orange.
         */
        .vibe { position: absolute; right: 3%; top: 2.5%; z-index: 3; font-size: var(--ctl); will-change: transform; transition: opacity 0.6s, color 0.2s, box-shadow 0.2s, visibility 0s; }
        .vibe[aria-checked="true"] {
          color: #ffd6f0;
          text-shadow: 0 0 0.6em rgba(255, 46, 147, 0.9);
          box-shadow: 0 -0.2em 0 0 #ff2e93, 0 0.2em 0 0 #ff2e93, -0.2em 0 0 0 #ff2e93, 0.2em 0 0 0 #ff2e93, 0 0 1.4em rgba(255, 46, 147, 0.75), inset 0 0 1em rgba(255, 46, 147, 0.25);
        }
        .vibe[aria-checked="true"] .sw { border-color: #ff2e93; background: #4a0f3a; }
        .vibe[aria-checked="true"] .sw i { transform: translateX(1.4em); background: #ff7ac0; box-shadow: 0 0 0.7em #ff2e93, 0 0 1.2em #00e5ff; }
        /* hidden on the INSERT COIN screen, and fades in when the car first sets off */
        /* the track box and the controls get layers of their own, so the repainting road behind them can't make them flicker */
        .track { transition: opacity 0.6s; will-change: transform; z-index: 3; }
        .controls { will-change: transform; z-index: 3; }
        .stage.intro .track { opacity: 0; }
        .course { position: relative; height: 3em; }
        /* the dashed road */
        .course::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0.35em;
          height: 0.22em;
          background: repeating-linear-gradient(90deg, #7df3ff 0 0.6em, transparent 0.6em 1.1em);
          opacity: 0.8;
        }
        .course > * { position: absolute; left: calc((1 - var(--at, 0)) * 100%); transform: translateX(-50%); }
        .mark { bottom: 0; font-style: normal; }
        .mark::after {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 0.5em;
          font-size: 0.85em;
          letter-spacing: 0.12em;
          white-space: nowrap;
        }
        /* START: a green pole and pennant */
        .mark.start { --at: 0; width: 0.9em; height: 2.4em; background: linear-gradient(#4dff9a, #4dff9a) 100% 0 / 0.18em 100% no-repeat, linear-gradient(225deg, #4dff9a 50%, transparent 50%) 0 0 / 0.7em 0.9em no-repeat; transform: translateX(calc(-100% + 0.09em)); }
        .mark.start::after { content: "START"; color: #4dff9a; transform: translateX(-70%); }
        /* FINISH: a checkered strip */
        .mark.finish { --at: 1; width: 1em; height: 2.4em; background: repeating-conic-gradient(#fff 0 25%, #14072f 0 50%) 0 0 / 0.5em 0.5em; box-shadow: 0 0 0.6em rgba(255, 255, 255, 0.4); }
        .mark.finish::after { content: "FINISH"; color: #fff3a8; transform: translateX(-30%); }
        .mark.finish.flash { animation: flash 1s ease-out; }
        @keyframes flash { 0% { box-shadow: 0 0 0 rgba(255, 255, 255, 0); } 25% { box-shadow: 0 0 1.6em 0.4em #fff3a8; } 100% { box-shadow: 0 0 0.6em rgba(255, 255, 255, 0.4); } }
        /* a mini billboard: a sign face on two legs, dim until the car has got there, then lit up */
        .stop { bottom: 0.45em; width: 2.2em; height: 2.2em; margin: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit; cursor: pointer; pointer-events: auto; }
        .stage.intro .stop { pointer-events: none; }
        .stop:disabled { cursor: default; }
        .stop:focus-visible { outline: 0.15em solid #fff3a8; outline-offset: 0.1em; }
        .stop:focus-visible b, .stop:not(:disabled):hover b { border-color: #fff3a8; box-shadow: 0 0 0.9em rgba(255, 243, 168, 0.8); }
        .stop::before {
          content: "";
          position: absolute;
          left: 0.4em;
          right: 0.4em;
          bottom: 0;
          height: 0.9em;
          background: linear-gradient(90deg, #6a6a82 0 0.22em, transparent 0.22em calc(100% - 0.22em), #6a6a82 calc(100% - 0.22em));
        }
        .stop b {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 1.4em;
          box-sizing: border-box;
          border: 0.16em solid #7a7a96;
          background: linear-gradient(#4a4a60 0 0.35em, #1d1d28 0.35em);
          transition: background 0.3s, border-color 0.3s, box-shadow 0.3s;
        }
        .stop.lit b {
          border-color: #ff4fa3;
          background: linear-gradient(#ff2e93 0 0.35em, #26105a 0.35em);
          box-shadow: 0 0 0.9em rgba(255, 46, 147, 0.7);
        }
        /* the car: a little white Countach side on, traced from a reference side view (low wedge, steep windscreen, black side intake, louvered skirt, front splitter, rear wing, five hole wheels), drawn facing left like the real car */
        .course > .me {
          bottom: 0.5em;
          width: 4.8em;
          height: 1.27em;
          z-index: 2;
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='12 108 500 132'%3E%3Cdefs%3E%3CclipPath id='b'%3E%3Cpath d='M20 203L24 199L60 176L100 160L142 149L228 123H293L296 126H335L378 130L396 138L440 142L480 150L497 158L504 172V182L497 192L492 200L470 214L455 222H90L40 218L20 212Z'/%3E%3C/clipPath%3E%3C/defs%3E%3Cpath d='M436 119L497 112V118L452 126Z' fill='%23e4e7ee'/%3E%3Cpath d='M485 111H498L483 136H473Z' fill='%23c4c8d2'/%3E%3Cpath d='M448 124L456 143M476 120L483 144' stroke='%239aa0ac' stroke-width='3'/%3E%3Cpath d='M20 203L24 199L60 176L100 160L142 149L228 123H293L296 126H335L378 130L396 138L440 142L480 150L497 158L504 172V182L497 192L492 200L470 214L455 222H90L40 218L20 212Z' fill='%23f1f2f6'/%3E%3Cpath d='M168 147L226 126H291V146Z' fill='%2347535e'/%3E%3Cpath d='M300 128H336V143H300Z' fill='%2336404a'/%3E%3Cpath d='M440 139L488 148V153L438 144Z' fill='%2316161f'/%3E%3Cpath d='M165 205H385V222H165Z' fill='%23b4b9c6'/%3E%3Cpath d='M262 211H345M262 215H345M262 219H345' stroke='%236c7280' stroke-width='2'/%3E%3Cpath d='M263 173L330 157L337 160V187L296 178Z' fill='%230e0e15'/%3E%3Cpath d='M141 150L185 204H270L293 138' stroke='%238f95a3' stroke-width='2' fill='none'/%3E%3Cpath d='M20 203L24 199L60 176L100 160L142 149L168 147' stroke='%23cfd3dc' stroke-width='2' fill='none'/%3E%3Cpath d='M20 212L40 218L90 222V226H20Z' fill='%238d93a0'/%3E%3Crect x='49' y='188' width='16' height='9' fill='%23f0a030'/%3E%3Crect x='468' y='169' width='20' height='11' fill='%23e63946'/%3E%3Cg clip-path='url(%23b)'%3E%3Ccircle cx='125' cy='203' r='41' fill='%2315111f'/%3E%3Ccircle cx='423' cy='203' r='47' fill='%2315111f'/%3E%3C/g%3E%3Cg transform='translate(125 203)'%3E%3Ccircle r='34' fill='%231c1c24'/%3E%3Ccircle r='27' fill='%23dadde4'/%3E%3Ccircle r='7' fill='%238a8f9c'/%3E%3Cg fill='%2322222c'%3E%3Ccircle cx='0' cy='-15' r='4.5'/%3E%3Ccircle cx='14.3' cy='-4.6' r='4.5'/%3E%3Ccircle cx='8.8' cy='12.1' r='4.5'/%3E%3Ccircle cx='-8.8' cy='12.1' r='4.5'/%3E%3Ccircle cx='-14.3' cy='-4.6' r='4.5'/%3E%3C/g%3E%3C/g%3E%3Cg transform='translate(423 203)'%3E%3Ccircle r='34' fill='%231c1c24'/%3E%3Ccircle r='27' fill='%23dadde4'/%3E%3Ccircle r='7' fill='%238a8f9c'/%3E%3Cg fill='%2322222c'%3E%3Ccircle cx='0' cy='-15' r='4.5'/%3E%3Ccircle cx='14.3' cy='-4.6' r='4.5'/%3E%3Ccircle cx='8.8' cy='12.1' r='4.5'/%3E%3Ccircle cx='-8.8' cy='12.1' r='4.5'/%3E%3Ccircle cx='-14.3' cy='-4.6' r='4.5'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") center / contain no-repeat;
          filter: drop-shadow(0 0 0.35em rgba(125, 243, 255, 0.8));
        }
        @keyframes blink { 50% { opacity: 0.35; } }
        /*
         * billboards share the road's tilted 3D space (.world is placed exactly like .plane), so they
         * are foreshortened by the same perspective. Each .board is stood upright on its bottom edge with
         * rotateX, turned along the road with rotateZ, and then slid along the road with a keyframe.
         * x is local to the road: negative is off its far (left) edge. y runs along the road, towards
         * the camera as it grows; the road moves the other way, so boards travel from big y to small y.
         */
        .world {
          --x: -22cqw;
          --y0: calc(var(--w) * ${RexLambo.y0});
          --y1: calc(var(--w) * ${RexLambo.y1});
          position: absolute;
          left: 52%;
          top: 62%;
          width: var(--w);
          height: calc(var(--w) * 60);
          transform: translate(-50%, -50%) rotateX(70deg) rotateZ(42deg);
          transform-style: preserve-3d;
        }
        /*
         * the barrier along the far edge of the road, retrowave style: a dark indigo wall with a neon magenta
         * top edge, a glowing cyan band, neon panel joints and amber reflector lamps, with a two tube neon
         * guard rail standing on top. A long upright face (placed like a billboard) carries the wall, its flat top
         * is folded back from the top edge, and the rail sits above it. Everything is gradients one --seg (48cqw)
         * wide, and sliding them one --seg per loop scrolls them with the road: one --seg is 48/76 of a road
         * block, so a loop takes that share of --road. (Glows are faked with soft gradients, because a CSS
         * filter would flatten the 3D space the barrier stands in.)
         */
        .barrier {
          --seg: 48cqw;
          position: absolute;
          left: 0;
          top: 0;
          width: calc(var(--w) * ${RexLambo.barrierBlocks}); /* one piece of the barrier (see RexLambo.barrierPieces); piece --i starts barrierBlocks blocks after the one before */
          height: 22cqw;
          transform-origin: 0 100%;
          transform: translate3d(-0.4cqw, calc(var(--w) * (8 + ${RexLambo.barrierBlocks} * var(--i, 0))), 0) rotateZ(90deg) rotateX(-90deg);
          transform-style: preserve-3d;
          background:
            /* amber reflector lamps with a soft halo */
            radial-gradient(ellipse 2.4cqw 1.3cqw at 18% 30%, #fff3d0 0 20%, #ffb347 38%, rgba(255, 120, 20, 0.35) 62%, transparent 100%) var(--off, 0cqw) 0 / var(--seg) 100%,
            radial-gradient(ellipse 2.4cqw 1.3cqw at 68% 30%, #e9ffff 0 20%, #5ff0ff 38%, rgba(0, 200, 255, 0.35) 62%, transparent 100%) var(--off, 0cqw) 0 / var(--seg) 100%,
            /* neon panel joint with a glow either side */
            linear-gradient(90deg, rgba(255, 46, 147, 0.5) 0 0.2cqw, #ff7ac0 0.2cqw 0.5cqw, rgba(255, 46, 147, 0.5) 0.5cqw 0.8cqw, transparent 1.6cqw) var(--off, 0cqw) 0 / var(--seg) 100%,
            /* glowing cyan band across the middle */
            linear-gradient(to bottom, transparent 0 52%, rgba(0, 229, 255, 0.25) 52% 56%, #7df3ff 56% 59%, rgba(0, 229, 255, 0.25) 59% 63%, transparent 63%),
            /* the wall: magenta glow at the top fading to deep indigo, cyan trim along the bottom */
            linear-gradient(to bottom, #ff2e93 0 2.5%, #ff62b0 2.5% 4%, #7a1f86 4% 14%, #3a1262 14% 45%, #230d48 45% 92%, #09c 92% 94%, #0b1630 94%);
          animation: slide calc(var(--road) * 48 / 76) linear infinite;
        }
        .lid, .rail {
          --seg: 48cqw;
          position: absolute;
          left: 0;
          width: 100%;
          animation: slide calc(var(--road) * 48 / 76) linear infinite;
        }
        .lid {
          top: 0;
          height: 8cqw;
          transform-origin: 0 0;
          transform: rotateX(-90deg);
          background:
            linear-gradient(90deg, rgba(20, 0, 40, 0.55) 0 0.4cqw, transparent 1cqw) var(--off, 0cqw) 0 / var(--seg) 100%,
            linear-gradient(to bottom, #ff9bd0, #ff2e93 60%, #c2207a);
        }
        .rail {
          bottom: 100%;
          height: 10cqw;
          background:
            /* two neon tubes: a hot core with a soft halo */
            linear-gradient(to bottom, transparent 0 60%, rgba(255, 46, 147, 0.4) 60% 65%, #ff2e93 65% 68%, #ffc2e2 68% 70%, #ff2e93 70% 73%, rgba(255, 46, 147, 0.4) 73% 78%, transparent 78%),
            linear-gradient(to bottom, transparent 0 12%, rgba(0, 200, 255, 0.4) 12% 17%, #00c8ff 17% 20%, #e0ffff 20% 22%, #00c8ff 22% 25%, rgba(0, 200, 255, 0.4) 25% 30%, transparent 30%),
            /* two posts per segment, indigo with neon edges */
            linear-gradient(90deg, #ff2e93 0 0.25cqw, #1c0a3f 0.25cqw 1.75cqw, #09c 1.75cqw 2cqw, transparent 2cqw 50%, #ff2e93 50% calc(50% + 0.25cqw), #1c0a3f calc(50% + 0.25cqw) calc(50% + 1.75cqw), #09c calc(50% + 1.75cqw) calc(50% + 2cqw), transparent calc(50% + 2cqw)) var(--off, 0cqw) 0 / var(--seg) 100%;
        }
        @keyframes slide { to { background-position-x: calc(var(--off, 0cqw) - var(--seg)); } }
        .skyline { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
        /*
         * a roadside billboard, about 80cqw wide: the sign face (a painted canvas under a bezel, scanlines and a faint
         * glare), a row of lamps along its top, a catwalk under it and two steel legs with a cross brace. The face's
         * bottom edge is 40cqw above the ground, so the whole banner stands clear above the barrier (wall 22 + rail 10).
         */
        .board {
          position: absolute;
          left: 0;
          top: 0;
          width: 80cqw;
          height: 82cqw;
          transform-origin: 0 100%;
          transform: translate3d(var(--x), var(--y0), 0) rotateZ(90deg) rotateX(-90deg); /* p = 0; see RexLambo.place */
        }
        .sign {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 42cqw;
          box-sizing: border-box;
          border: 1.6cqw solid #1d1d28;
          background: #000;
          box-shadow: 0 0 0 0.45cqw #5b5b72, 0 0 4cqw rgba(0, 170, 220, 0.45);
        }
        .sign canvas { display: block; width: 100%; height: 100%; image-rendering: pixelated; transform: scaleX(-1); }
        /* lamps along the top edge, on short arms, each with a soft glow */
        .lamps {
          position: absolute;
          left: 4%;
          right: 4%;
          top: -4.5cqw;
          height: 4.5cqw;
          background:
            radial-gradient(ellipse 2.4cqw 1.4cqw at 50% 25%, #fffbe0 0 25%, rgba(255, 236, 160, 0.7) 45%, transparent 100%) 0 0 / 19% 100%,
            linear-gradient(90deg, transparent 0 7.4%, #2c2c3a 7.4% 8.6%, transparent 8.6%) 0 100% / 19% 60% no-repeat,
            linear-gradient(#2c2c3a, #2c2c3a) 0 100% / 100% 0.8cqw no-repeat;
          background-repeat: repeat-x, repeat-x, no-repeat;
        }
        /* the catwalk under the sign, with a rail along its front */
        .walk {
          position: absolute;
          left: -2%;
          right: -2%;
          top: 42cqw;
          height: 3.4cqw;
          background:
            linear-gradient(#6c6c84 0 0.6cqw, #3a3a4c 0.6cqw 2.4cqw, #20202c 2.4cqw);
          box-shadow: 0 -1.6cqw 0 -0.9cqw #4a4a60;
        }
        .post {
          position: absolute;
          top: 45cqw;
          bottom: 0;
          width: 3.6cqw;
          background: linear-gradient(90deg, #6a6a82 0 18%, #3a3a4c 18% 70%, #1e1e2a 70%);
        }
        .post.a { left: 14%; }
        .post.b { right: 14%; }
        /* an X brace between the legs */
        .brace {
          position: absolute;
          left: 15%;
          right: 15%;
          top: 52cqw;
          height: 24cqw;
          background:
            linear-gradient(to top right, transparent calc(50% - 0.5cqw), #3a3a4c calc(50% - 0.5cqw) calc(50% + 0.5cqw), transparent calc(50% + 0.5cqw)),
            linear-gradient(to top left, transparent calc(50% - 0.5cqw), #3a3a4c calc(50% - 0.5cqw) calc(50% + 0.5cqw), transparent calc(50% + 0.5cqw));
        }
        @media (prefers-reduced-motion: reduce) { .spin, .plane, .barrier, .lid, .rail { animation-play-state: paused; } }
      </style>
      <div class="stage intro"><div class="sky" aria-hidden="true"><canvas class="stars"></canvas></div><div class="moon" aria-hidden="true"></div><canvas class="skyline" aria-hidden="true"></canvas><div class="status sr" role="status" aria-live="polite"></div><div class="view"><div class="scene" aria-hidden="true">
        <div class="road"><div class="ground">${roadTiles}</div><div class="world">${barrier}</div></div>
        <div class="ao"><i class="long"></i><i class="body"></i><i class="fw"></i><i class="rw"></i></div>
        <img src="${src}" alt="Lamborghini Countach" draggable="false" />
        ${wheels}
      </div><div class="table" role="region" aria-label="Details" tabindex="0"></div><div class="hint" aria-hidden="true">insert coin</div>
      <div class="controls"><button type="button" class="turbo" role="switch" aria-checked="false"><span>TURBO</span><span class="sw"><i></i></span></button><button type="button" class="sound" role="switch" aria-checked="true" aria-label="Music"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M3 9h4l5-4v14l-5-4H3z"/><path class="wave" d="M15.5 8.5a5 5 0 0 1 0 7M18 5.5a9 9 0 0 1 0 13"/><path class="off" d="M15 9l6 6M21 9l-6 6"/></svg></button></div>
      <button type="button" class="vibe" role="switch" aria-checked="false"><span>VIBE MODE</span><span class="sw"><i></i></span></button>
      <div class="track"><div class="course"><i class="mark start"></i>${stops}<i class="mark finish"></i><i class="me"></i></div></div></div></div>
      <dialog class="viewer" aria-label="Media viewer"><div class="box"></div><button type="button" class="x" aria-label="Close">\u00D7</button></dialog>
    `;
    this.applyState();
  }
}

customElements.define("rex-lambo", RexLambo);
