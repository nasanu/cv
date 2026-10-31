//custom isometric supercar element: a Ferrari Testarossa (white, Miami style)
//driving towards the viewer along an endlessly scrolling city highway, with traffic,
//overhead signs, billboards and tower blocks. Pure HTML, CSS and JS, no assets.
//
//attributes
//  speed  - world units per second the road scrolls at (default 320)
//  color  - body colour (default #f2f2f6, white; #d4001a is Rosso Corsa red)
//  paused - when present the animation is frozen

//world units; the whole scene is authored at this width then scaled to fit
const DESIGN_WIDTH = 620;

//the car: +y is the rear of the car, the car drives towards -y (up and right
//on screen). The camera sees the car's right side (x = CAR_W), rear and top.
const CAR_W = 64;
const CAR_L = 144;

//Vehicles (the supercar and all the traffic) are modelled at 32 units per metre
//then drawn at VEH_SCALE so they sit comfortably beside the buildings.
const VEH_SCALE = 0.7;

//highway layout, in world x (the car drives down the middle of lane A at x = 0):
//  right guardrail 54 | shoulder | lane A | lane B | shoulder | median |
//  shoulder | lane C | lane D | shoulder | left guardrail -316
const LANE_W = 72;
const HWY_LEFT = -316;
const HWY_RIGHT = 54;
const HWY_W = HWY_RIGHT - HWY_LEFT;
const MEDIAN_L = -136;
const MEDIAN_R = -126;
const MEDIAN_H = 16;
const LANE_B = -72;
const LANE_C = -190;
const LANE_D = -262;
const LAMP_SPACING = 340;
const LAMP_COUNT = 5;
const LAMP_RING = LAMP_SPACING * LAMP_COUNT;
//everything that loops uses a ring this long (wrapping happens far off screen)
const RING = 1800;
const r2 = (n) => Math.round(n * 100) / 100;

//a cuboid made of its three camera facing faces (top, rear/+y, right/+x)
const box = ({ x, y, z = 0, w, d, h, t, f, r, k, cls = "" }) =>
  `<div class="box ${cls}" style="left:${x}px;top:${y}px;--w:${w}px;--d:${d}px;--h:${h}px;--ct:${t};--cf:${f};--cr:${r};--ck:${k ?? f};transform:translateZ(${z}px)"><i class="t"></i><i class="f"></i><i class="r"></i><i class="k"></i></div>`;

//a flat panel tilted between two points of the car's side profile.
//p0 and p1 are [y, z]; the panel spans the car width from x for w.
const slab = (x, w, p0, p1, cls, style = "") => {
  const dy = p1[0] - p0[0];
  const dz = p1[1] - p0[1];
  const len = Math.hypot(dy, dz);
  const ang = (Math.atan2(dz, dy) * 180) / Math.PI;
  return `<i class="face slab ${cls}" style="left:${x}px;top:${p0[0]}px;width:${w}px;height:${r2(len)}px;transform:translateZ(${p0[1]}px) rotateX(${r2(ang)}deg);${style}"></i>`;
};

//a vertical panel facing +x whose outline is a polygon of [y, z] points.
//local x runs up (z) and local y runs towards the rear (y).
const sideFace = (x, pts, cls, style = "") => {
  const y0 = Math.min(...pts.map((p) => p[0]));
  const y1 = Math.max(...pts.map((p) => p[0]));
  const z1 = Math.max(...pts.map((p) => p[1]));
  const poly = pts.map(([y, z]) => `${r2(z)}px ${r2(y - y0)}px`).join(",");
  return `<i class="face side ${cls}" style="left:${x}px;top:${y0}px;width:${r2(z1)}px;height:${r2(y1 - y0)}px;clip-path:polygon(${poly});${style}"></i>`;
};

//a wheel (plus the dark arch behind it) on the right side of the car
const wheel = (y, r, arch) => `
  <i class="circ arch" style="left:${CAR_W + 0.4}px;top:${y - arch}px;width:${arch * 2}px;height:${arch * 2}px;transform:translateZ(${r - arch}px) rotateY(-90deg)"></i>
  <i class="circ wheel" style="left:${CAR_W + 0.8}px;top:${y - r}px;width:${r * 2}px;height:${r * 2}px;transform:rotateY(-90deg)"><b class="spin"></b></i>`;

//A Ferrari Testarossa (1984): 2.0 m wide, 4.5 m long and only 1.13 m tall. A long low
//wedge: flat nose with flip up headlights, a long hood, a raked windshield, a long flat
//roof and a very wide tail. Its trademark is the row of horizontal strakes over the side
//intakes ahead of the rear wheels. There is no wing.
//Modelled with the nose at y = 0 (the whole car is mirrored by .flip so that it drives
//towards the camera).
const carHTML = () => {
  //the shoulder line (top of the body) climbs from the nose to the tail
  const shoulder = (y) =>
    y <= 50 ? 11 + y * (7 / 50) : 18 + (y - 50) * (9 / 94);
  //side profile as [y, z]
  const nose = [0, 11];
  const cowl = [50, 18];
  const roofF = [85, 36];
  const roofR = [108, 36];
  const glassR = [124, 28.5];
  const tail = [CAR_L, 27];
  const GX = 8; //the greenhouse spans x = 8 to 56
  const GW = CAR_W - 16;

  return `
  <div class="car"><div class="flip">
    <i class="face shadow"></i>
    <i class="face beam"></i>
    <i class="face trail" style="left:9px"></i>
    <i class="face trail" style="left:47px"></i>
    <div class="body">
      ${sideFace(CAR_W, [[0, 5], nose, cowl, tail, [CAR_L, 5]], "panel")}
      ${sideFace(
        CAR_W + 0.15,
        [
          [0, 5],
          [0, 8.5],
          [CAR_L, 8.5],
          [CAR_L, 5],
        ],
        "sill",
      )}

      ${sideFace(
        CAR_W + 0.2,
        [
          [62, 10],
          [62, shoulder(62) - 2],
          [98, shoulder(98) - 2],
          [98, 10],
        ],
        "strakes",
      )}
      ${sideFace(
        CAR_W + 0.25,
        [
          [53, 9.6],
          [53, shoulder(53) - 0.4],
          [54, shoulder(54) - 0.4],
          [54, 9.6],
        ],
        "cut",
      )}
      ${sideFace(
        CAR_W + 0.25,
        [
          [81.5, 9.6],
          [81.5, shoulder(81.5) - 0.4],
          [82.5, shoulder(82.5) - 0.4],
          [82.5, 9.6],
        ],
        "cut",
      )}
      ${sideFace(
        CAR_W + 0.25,
        [
          [53, 9.6],
          [82.5, 9.6],
          [82.5, 10.6],
          [53, 10.6],
        ],
        "cut",
      )}
      ${sideFace(
        CAR_W + 0.25,
        [
          [72, 15.4],
          [78, 15.4],
          [78, 16.6],
          [72, 16.6],
        ],
        "cut",
      )}
      ${wheel(30, 10, 12.5)}
      ${wheel(112, 10.6, 13.6)}

      ${slab(0, CAR_W, nose, cowl, "hood", "clip-path:polygon(9% 0,91% 0,100% 100%,0 100%)")}
      ${slab(0, CAR_W, cowl, tail, "deck")}
      ${slab(10, CAR_W - 20, [123, 25.2], [141, 26.9], "louvres")}

      ${sideFace(CAR_W - 8, [cowl, roofF, roofR, glassR, [124, 25.1]], "cabin")}
      ${slab(GX, GW, cowl, roofF, "glass screen")}
      ${slab(GX, GW, roofF, roofR, "roof")}
      ${slab(GX, GW, roofR, glassR, "glass rearscreen")}

      <i class="face nose" style="left:0;top:0;width:${CAR_W}px;height:6px;transform:translateZ(5px) rotateX(90deg)"></i>

      ${box({ x: 58, y: 56, z: 21, w: 9, d: 4, h: 3, t: "#15151b", f: "#0b0b10", r: "#0b0b10" })}
    </div>
  </div></div>`;
};
//a double arm lamp standing on the median barrier, lighting both carriageways.
//The arms are high enough for the tallest lorry to pass under.
const lampHTML = (y) => {
  const px = (MEDIAN_L + MEDIAN_R) / 2;
  const metal = { t: "#3a2b55", f: "#241838", r: "#140c24" };
  const bulb = { t: "#fff1d0", f: "#9b7bd4", r: "#6a4ba3" };
  return `<div class="shift" style="top:${y}px">
    ${box({ x: px - 2, y: -2, z: MEDIAN_H, w: 4, d: 4, h: 96, ...metal })}
    ${box({ x: px + 2, y: -1.5, z: 108, w: 44, d: 3, h: 2.5, ...metal })}
    ${box({ x: px - 46, y: -1.5, z: 108, w: 44, d: 3, h: 2.5, ...metal })}
    ${box({ x: px + 40, y: -4, z: 105, w: 12, d: 8, h: 3, ...bulb })}
    ${box({ x: px - 52, y: -4, z: 105, w: 12, d: 8, h: 3, ...bulb })}
    <i class="face pool" style="left:${px + 46 - 45}px;top:-45px"></i>
    <i class="face pool" style="left:${px - 46 - 45}px;top:-45px"></i>
  </div>`;
};
/* ---------- billboards ---------- */

const BB_W = 120;
const BB_H = 67;
const BB_SPACING = 567;
const BB_COUNT = 3;
const BB_RING = BB_SPACING * BB_COUNT;

//every billboard faces the road. "L" billboards stand on the -x side and face +x
//(towards the camera); "R" billboards stand on the +x side and face -x, so the
//camera sees their backs. All of them are in the front row, just back from the
//road. Each is centred on y = 0 and moved along the road by JS.
const billboardHTML = (side) => {
  const metal = { t: "#2b2046", f: "#1a1230", r: "#120b22" };
  const back = {
    t: "#2b2046",
    f: "#1a1230",
    r: "repeating-linear-gradient(90deg,#1a1230 0 10px,#2a1f47 10px 12px)",
  };
  const lamp = { t: "#fff3c4", f: "#9b7bd4", r: "#6a4ba3" };
  const z0 = 30;
  const top = z0 + BB_H;

  if (side === "L") {
    const px = HWY_LEFT - 23;
    return `<div class="bb">
      ${box({ x: px - 4, y: -BB_W / 2 + 14, w: 4, d: 4, h: z0, ...metal })}
      ${box({ x: px - 4, y: BB_W / 2 - 18, w: 4, d: 4, h: z0, ...metal })}
      ${box({ x: px - 3, y: -BB_W / 2 - 4, z: z0 - 4, w: 3, d: BB_W + 8, h: BB_H + 8, ...metal })}
      ${box({ x: px, y: -BB_W / 2 + 6, z: top + 4, w: 7, d: 8, h: 2, ...lamp })}
      ${box({ x: px, y: BB_W / 2 - 14, z: top + 4, w: 7, d: 8, h: 2, ...lamp })}
      <i class="face bbglow" style="left:${px - 20}px;top:-80px"></i>
      <i class="face poster" style="left:${px + 0.2}px;top:${BB_W / 2}px;width:${BB_W}px;height:${BB_H}px;transform:translateZ(${top}px) rotateY(90deg) rotateZ(-90deg)"></i>
    </div>`;
  }

  const px = 200;
  return `<div class="bb">
    ${box({ x: px, y: -BB_W / 2 + 14, w: 4, d: 4, h: z0, ...metal })}
    ${box({ x: px, y: BB_W / 2 - 18, w: 4, d: 4, h: z0, ...metal })}
    ${box({ x: px, y: -BB_W / 2 - 4, z: z0 - 4, w: 3, d: BB_W + 8, h: BB_H + 8, ...back })}
    ${box({ x: px - 7, y: -BB_W / 2 + 6, z: top + 4, w: 7, d: 8, h: 2, ...lamp })}
    ${box({ x: px - 7, y: BB_W / 2 - 14, z: top + 4, w: 7, d: 8, h: 2, ...lamp })}
    <i class="face bbglow" style="left:${px - 140}px;top:-80px"></i>
    <i class="face poster" style="left:${px - 0.2}px;top:${-BB_W / 2}px;width:${BB_W}px;height:${BB_H}px;transform:translateZ(${top}px) rotateY(-90deg) rotateZ(90deg)"></i>
  </div>`;
};

//posters are painted once onto small canvases, then used as textures. The
//games are made up, but they are the classic arcade archetypes.
const PW = 264;
const PH = 148;

const pixels = (ctx, rows, x, y, s, pal) => {
  rows.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch !== ".") {
        ctx.fillStyle = pal[ch] || pal["#"];
        ctx.fillRect(x + i * s, y + j * s, s, s);
      }
    }),
  );
};

const label = (ctx, str, x, y, size, fill, stroke = "#000") => {
  ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size / 5);
  ctx.strokeStyle = stroke;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
};

const backdrop = (ctx, top, bottom) => {
  const g = ctx.createLinearGradient(0, 0, 0, PH);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PW, PH);
};

const INVADER = [
  "..#.....#..",
  "...#...#...",
  "..#######..",
  ".##.###.##.",
  "###########",
  "#.#######.#",
  "#.#.....#.#",
  "...##.##...",
];
const CANNON = [
  ".....#.....",
  "....###....",
  "...#####...",
  ".#########.",
  "###########",
];
const HERO = [
  "..BBBBB..",
  ".BBBBBBB.",
  ".BSSSSSB.",
  ".SSKSKSS.",
  ".SSSSSSS.",
  "..RRRRR..",
  ".RRRRRRR.",
  "SRRRRRRRS",
  ".RRRRRRR.",
  "..BB.BB..",
  ".BBB.BBB.",
  ".BB...BB.",
];
const RACER = [
  "..RRRRRRRR..",
  ".RRRWWWWRRR.",
  "RRRRRRRRRRRR",
  "RLLRRRRRRLLR",
  "KKRRRRRRRRKK",
  "KK........KK",
];

const ghost = (ctx, x, y, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 14, Math.PI, 0);
  ctx.lineTo(x + 14, y + 14);
  for (let i = 0; i < 3; i++) {
    ctx.lineTo(x + 14 - (i + 0.5) * (28 / 3), y + 9);
    ctx.lineTo(x + 14 - (i + 1) * (28 / 3), y + 14);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x - 5, y - 3, 4, 0, Math.PI * 2);
  ctx.arc(x + 5, y - 3, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1d3bff";
  ctx.beginPath();
  ctx.arc(x - 3.5, y - 3, 2, 0, Math.PI * 2);
  ctx.arc(x + 6.5, y - 3, 2, 0, Math.PI * 2);
  ctx.fill();
};

const cloud = (ctx, x, y) => {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.arc(x + 12, y - 5, 11, 0, Math.PI * 2);
  ctx.arc(x + 25, y, 9, 0, Math.PI * 2);
  ctx.fill();
};

const POSTERS = [
  //space shooter
  (ctx) => {
    backdrop(ctx, "#05001a", "#1b0a4a");
    ["#4dff88", "#ff5fd2", "#46d9ff"].forEach((color, r) => {
      for (let c = 0; c < 6; c++) {
        pixels(ctx, INVADER, 30 + c * 40, 40 + r * 22, 2, { "#": color });
      }
    });
    pixels(ctx, CANNON, PW / 2 - 16, 108, 3, { "#": "#7dff6a" });
    ctx.fillStyle = "#fff";
    ctx.fillRect(PW / 2 - 1, 84, 2, 18);
    label(ctx, "ALIEN RAID", PW / 2, 28, 26, "#7dff6a", "#002a10");
    label(ctx, "DEFEND EARTH", PW / 2, 142, 13, "#fff");
  },
  //maze chomper
  (ctx) => {
    backdrop(ctx, "#02000f", "#02000f");
    ctx.strokeStyle = "#2a4bff";
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 44, PW - 24, 82);
    ctx.strokeRect(18, 50, PW - 36, 70);
    ctx.fillStyle = "#ffd9b0";
    for (let x = 206; x < 250; x += 14) {
      ctx.beginPath();
      ctx.arc(x, 85, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ghost(ctx, 44, 85, "#ff2a2a");
    ghost(ctx, 82, 85, "#ff9ad5");
    ghost(ctx, 120, 85, "#2cf2ff");
    ctx.fillStyle = "#ffe600";
    ctx.beginPath();
    ctx.moveTo(172, 85);
    ctx.arc(172, 85, 22, 0.25 * Math.PI, 1.75 * Math.PI);
    ctx.closePath();
    ctx.fill();
    label(ctx, "MUNCH-MAN", PW / 2, 32, 26, "#ffe600", "#4a3a00");
    label(ctx, "EAT THE DOTS", PW / 2, 142, 13, "#fff");
  },
  //falling blocks
  (ctx) => {
    backdrop(ctx, "#0a1230", "#14307a");
    const cell = 8;
    const x0 = 100;
    const y0 = 10;
    ctx.fillStyle = "#050a1e";
    ctx.fillRect(x0, y0, cell * 8, cell * 16);
    ctx.strokeStyle = "#6aa0ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 - 1, y0 - 1, cell * 8 + 2, cell * 16 + 2);
    const colors = [
      "#ff4d4d",
      "#ffb347",
      "#ffe14a",
      "#4dff88",
      "#46d9ff",
      "#6a7bff",
      "#d36bff",
    ];
    const block = (c, r, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x0 + c * cell, y0 + r * cell, cell - 1, cell - 1);
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.fillRect(x0 + c * cell, y0 + r * cell, cell - 1, 2);
    };
    let seed = 7;
    const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let r = 10; r < 16; r++) {
      for (let c = 0; c < 8; c++) {
        if (rand() > (r === 10 ? 0.55 : 0.12))
          block(c, r, colors[Math.floor(rand() * 7)]);
      }
    }
    [
      [3, 2],
      [4, 2],
      [5, 2],
      [4, 3],
    ].forEach(([c, r]) => block(c, r, "#d36bff"));
    label(ctx, "BLOCK", 50, 76, 24, "#ffe14a", "#3a2a00");
    label(ctx, "DROP", 214, 76, 24, "#46d9ff", "#00263a");
    label(ctx, "STACK 'EM UP", 50, 132, 9, "#fff");
  },
  //bat and ball
  (ctx) => {
    backdrop(ctx, "#000", "#06061a");
    ctx.fillStyle = "#fff";
    for (let y = 8; y < PH - 20; y += 14) ctx.fillRect(PW / 2 - 2, y, 4, 8);
    ctx.fillRect(14, 46, 7, 38);
    ctx.fillRect(PW - 21, 66, 7, 38);
    ctx.fillRect(168, 78, 7, 7);
    ctx.font = "900 34px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("03", 100, 46);
    ctx.fillText("07", 164, 46);
    label(ctx, "PADDLE WARS", PW / 2, 136, 20, "#2cf2ff", "#00323a");
  },
  //platformer
  (ctx) => {
    backdrop(ctx, "#5c94fc", "#5c94fc");
    cloud(ctx, 20, 40);
    cloud(ctx, 150, 28);
    cloud(ctx, 205, 62);
    ctx.fillStyle = "#00a800";
    ctx.beginPath();
    ctx.arc(60, PH - 26, 34, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#c84c0c";
    ctx.fillRect(0, PH - 26, PW, 26);
    ctx.strokeStyle = "#7a2a00";
    ctx.lineWidth = 2;
    for (let x = 0; x < PW; x += 22) {
      ctx.strokeRect(x, PH - 26, 22, 13);
      ctx.strokeRect(x + 11, PH - 13, 22, 13);
    }
    ctx.fillStyle = "#00a800";
    ctx.fillRect(206, PH - 26 - 36, 34, 36);
    ctx.fillRect(202, PH - 26 - 36, 42, 12);
    ctx.fillStyle = "#80d010";
    ctx.fillRect(210, PH - 26 - 34, 5, 32);
    ["#ffd23f"].forEach((c) => {
      ctx.fillStyle = c;
      [
        [84, 66],
        [104, 58],
        [124, 66],
      ].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.ellipse(x, y, 5, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    pixels(ctx, HERO, 150, 56, 3, {
      B: "#1e5bff",
      S: "#ffcf9a",
      K: "#000",
      R: "#ff3b30",
    });
    label(ctx, "SUPER HOP", PW / 2, 30, 26, "#ffe14a", "#a31200");
  },
  //racer
  (ctx) => {
    backdrop(ctx, "#2a0a5a", "#ff6a3d");
    ctx.fillStyle = "#12052a";
    ctx.fillRect(0, 74, PW, PH - 74);
    const sun = ctx.createLinearGradient(0, 44, 0, 74);
    sun.addColorStop(0, "#fff08a");
    sun.addColorStop(1, "#ff3fa4");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(PW / 2, 74, 30, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#c84a6a";
    for (let i = 0; i < 4; i++)
      ctx.fillRect(PW / 2 - 30, 56 + i * 5, 60, 1 + i);
    ctx.fillStyle = "#2a2a3c";
    ctx.beginPath();
    ctx.moveTo(PW / 2 - 8, 74);
    ctx.lineTo(PW / 2 + 8, 74);
    ctx.lineTo(PW / 2 + 78, PH);
    ctx.lineTo(PW / 2 - 78, PH);
    ctx.fill();
    ctx.fillStyle = "#ffe28a";
    [
      [80, 3],
      [92, 5],
      [106, 7],
      [124, 9],
    ].forEach(([y, w]) => ctx.fillRect(PW / 2 - w / 2, y, w, 8));
    ctx.strokeStyle = "#ff2bd6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PW / 2 - 8, 74);
    ctx.lineTo(PW / 2 - 78, PH);
    ctx.moveTo(PW / 2 + 8, 74);
    ctx.lineTo(PW / 2 + 78, PH);
    ctx.stroke();
    pixels(ctx, RACER, PW / 2 - 18, 108, 3, {
      R: "#e0102a",
      W: "#3a5cff",
      L: "#ff7a7a",
      K: "#000",
    });
    label(ctx, "TURBO RUN", PW / 2, 28, 26, "#ffe14a", "#7a003a");
  },
  //arcade attract screen
  (ctx) => {
    backdrop(ctx, "#08001a", "#1a0036");
    label(ctx, "PLAYER 1", PW / 2, 48, 32, "#ff3df0", "#3a0036");
    label(ctx, "PRESS START", PW / 2, 88, 26, "#2cf2ff", "#00323a");
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.ellipse(52, 126, 28, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#999";
    ctx.fillRect(49, 100, 6, 26);
    ctx.fillStyle = "#ff2a2a";
    ctx.beginPath();
    ctx.arc(52, 98, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2cf2ff";
    ctx.beginPath();
    ctx.arc(94, 122, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.arc(116, 114, 7, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, "HIGH SCORE 999999", 186, 126, 14, "#ffd23f");
  },
];

const makePoster = (draw) => {
  const canvas = document.createElement("canvas");
  canvas.width = PW;
  canvas.height = PH;
  const ctx = canvas.getContext("2d");
  draw(ctx);
  //scanlines and a neon edge so every poster feels like a screen
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  for (let y = 0; y < PH; y += 3) ctx.fillRect(0, y, PW, 1);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, PW - 3, PH - 3);
  return `url(${canvas.toDataURL()})`;
};

/* ---------- city ground textures ---------- */

const ASPHALT_TILE = 256;
const PLAZA_TILE = 128;

const tileTexture = (w, h, paint) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  paint(ctx, w, h);
  return `url(${canvas.toDataURL()})`;
};

//per pixel speckle so surfaces read as grainy asphalt / concrete
const grain = (ctx, w, h, base, spread) => {
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() - 0.5) * spread;
    img.data[i] = base[0] + v;
    img.data[i + 1] = base[1] + v;
    img.data[i + 2] = base[2] + v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
};

//run a drawing function again at every neighbouring tile offset so whatever
//crosses an edge wraps round and the texture still repeats seamlessly
const wrapped = (ctx, w, h, draw) => {
  for (const dx of [-w, 0, w]) {
    for (const dy of [-h, 0, h]) {
      ctx.save();
      ctx.translate(dx, dy);
      draw();
      ctx.restore();
    }
  }
};

const blotches = (ctx, w, h, count, maxR) => {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 4 + Math.random() * maxR;
    const light = Math.random() > 0.5;
    wrapped(ctx, w, h, () => {
      ctx.fillStyle = light ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.07)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
};

//worn highway asphalt: grain, blotches, hairline cracks, patched strips
const paintAsphalt = (ctx, w, h) => {
  grain(ctx, w, h, [48, 47, 58], 24);
  blotches(ctx, w, h, 110, 20);

  ctx.strokeStyle = "rgba(10,10,16,0.65)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    let x = Math.random() * w;
    let y = Math.random() * h;
    const pts = [[x, y]];
    for (let k = 0; k < 7; k++) {
      x += (Math.random() - 0.5) * 14;
      y += 5 + Math.random() * 8;
      pts.push([x, y]);
    }
    wrapped(ctx, w, h, () => {
      ctx.beginPath();
      pts.forEach(([px, py], n) =>
        n ? ctx.lineTo(px, py) : ctx.moveTo(px, py),
      );
      ctx.stroke();
    });
  }

  for (let i = 0; i < 6; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const pw = 30 + Math.random() * 40;
    const ph = 20 + Math.random() * 30;
    wrapped(ctx, w, h, () => {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(x, y, pw, ph);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.strokeRect(x + 0.5, y + 0.5, pw, ph);
    });
  }
};

//paving slabs, laid in a running bond
const paintPavers = (ctx, w, h, base, cols, rows, spread, joint = 0.45) => {
  grain(ctx, w, h, base, spread);
  const pw = w / cols;
  const ph = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * pw + (r % 2 ? pw / 2 : 0);
      wrapped(ctx, w, h, () => {
        ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},${(Math.random() * 0.07).toFixed(3)})`;
        ctx.fillRect(x, r * ph, pw, ph);
        ctx.strokeStyle = `rgba(0,0,0,${joint})`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, r * ph, pw, ph);
      });
    }
  }
};

const paintSidewalk = (ctx, w, h) =>
  paintPavers(ctx, w, h, [116, 112, 128], 2, 2, 16);

const paintPlaza = (ctx, w, h) => {
  paintPavers(ctx, w, h, [66, 64, 80], 2, 2, 14, 0.22);
  blotches(ctx, w, h, 14, 20);
};

//vertical bands of colour across a box, for painted lines. items: [x0, x1, colour]
const stripes = (items) => {
  let prev = 0;
  const parts = [];
  [...items]
    .sort((a, b) => a[0] - b[0])
    .forEach(([a, b, colour]) => {
      parts.push(`transparent ${prev}px ${a}px`, `${colour} ${a}px ${b}px`);
      prev = b;
    });
  parts.push(`transparent ${prev}px`);
  return `linear-gradient(90deg,${parts.join(",")})`;
};

//all x values here are relative to the left edge of the highway surface
const LEFT0 = -HWY_LEFT;
const roadMarks = stripes([
  [LEFT0 + 36, LEFT0 + 39, "#e6e6ee"], //right edge of lane A
  [LEFT0 - 111, LEFT0 - 108, "#f2c230"], //left edge of lane B (yellow, by the median)
  [LEFT0 - 157, LEFT0 - 154, "#f2c230"], //edge of lane C (yellow, by the median)
  [LEFT0 - 301, LEFT0 - 298, "#e6e6ee"], //outer edge of lane D
]);
const wheelTracks = stripes(
  [0, LANE_B, LANE_C, LANE_D].flatMap((lane) =>
    [-13, 13].map((o) => [
      LEFT0 + lane + o - 3.5,
      LEFT0 + lane + o + 3.5,
      "rgba(0,0,0,0.2)",
    ]),
  ),
);
//dashed lane dividers (left edge of the 3px line)
const DASH_LEFTS = [LEFT0 - 36 - 1.5, LEFT0 - 226 - 1.5];
/* ---------- tower blocks ---------- */

const BLD_COUNT = 12;
const BLD_SPACING = RING / BLD_COUNT;
//buildings keep clear of the road: the right ones start at x = 345 and stay low
//enough never to hide the car, the left ones are behind the car so can be tall
const BLD_RIGHT_X = 345;
const BLD_LEFT_X = -390;

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const WALLS = [
  "#2b2a4a",
  "#3a2f55",
  "#24344f",
  "#33304a",
  "#4a3550",
  "#2a3b4d",
  "#3b3a52",
];
const LIGHTS = [
  ["#ffd98a", "#ffa65a"],
  ["#bfe6ff", "#7ab8ff"],
  ["#ffe6b0", "#ff9ec2"],
  ["#fff2c8", "#ffcf6a"],
];

const buildingHTML = () =>
  `<div class="bldslot">${box({ x: 0, y: 0, w: 80, d: 80, h: 120, t: "var(--roof)", f: "var(--facade-f)", r: "var(--facade-r)", cls: "bld" })}</div>`;

//give a building a new random size, colour and lit windows
const restyleBuilding = (slot, side) => {
  const el = slot.firstElementChild;
  const w = rnd(60, 100);
  const d = rnd(60, 100);
  const h = side < 0 ? rnd(90, 300) : rnd(50, 190);
  const [lit, lit2] = pick(LIGHTS);
  el.style.left = (side < 0 ? BLD_LEFT_X - w : BLD_RIGHT_X) + "px";
  el.style.top = -d / 2 + "px";
  el.style.setProperty("--w", r2(w) + "px");
  el.style.setProperty("--d", r2(d) + "px");
  el.style.setProperty("--h", r2(h) + "px");
  el.style.setProperty("--wall", pick(WALLS));
  el.style.setProperty("--lit", lit);
  el.style.setProperty("--lit2", lit2);
  el.style.setProperty("--p1", Math.floor(rnd(14, 40)) + "px");
};

/* ---------- traffic ---------- */

const CAR_COLOURS = [
  "#2a6df4",
  "#e8e8f0",
  "#f2b31c",
  "#1fb36b",
  "#8a2be2",
  "#d94a8c",
  "#3d3d4a",
  "#b22222",
];
const TRUCK_COLOURS = ["#e8e8f0", "#d9722b", "#2a6df4", "#1fb36b", "#c9b02a"];

//Real sizes at 32 units per metre (the supercar is 2.0 m wide, 4.7 m long); the
//whole vehicle is then drawn at VEH_SCALE:
//  hatchback 1.75 x 3.9 m, saloon 1.85 x 4.7 m, SUV 1.95 x 4.8 m,
//  rigid lorry 2.5 x 7.7 m x 3.6 m high, articulated lorry 2.55 x 15 m x 4 m high.
//w/l are width/length, body/cab the heights of the lower body and the cabin on
//top of it, cabL the cabin length and shift how far it sits towards the rear.
const CARS = {
  hatch: { w: 56, l: 125, body: 22, cab: 20, cabW: 46, cabL: 82, shift: 14 },
  sedan: { w: 59, l: 150, body: 22, cab: 18, cabW: 49, cabL: 78, shift: 8 },
  suv: { w: 62, l: 154, body: 28, cab: 22, cabW: 52, cabL: 112, shift: 10 },
};

//front is +1 when the vehicle drives towards +y (we see its headlights) and -1 when
//it drives towards -y (we see its tail lights). Centred on the origin.
const vehicleHTML = (kind, colour, front) => {
  const lights = front > 0 ? "#fff6c8" : "#ff3030";
  const band = `linear-gradient(90deg,${lights} 0 22%,transparent 22% 78%,${lights} 78%) 0 35% / 100% 30% no-repeat`;
  const lightsOther = front > 0 ? "#ff3030" : "#fff6c8";
  const bandOther = `linear-gradient(90deg,${lightsOther} 0 22%,transparent 22% 78%,${lightsOther} 78%) 0 35% / 100% 30% no-repeat`;
  const glass = "#0d1f3f";
  const dark = { t: "#15131f", f: "#0e0d15", r: "#0e0d15" };

  //a box spanning u0..u1 along the vehicle (u runs from the rear to the front)
  const part = (u0, u1, o) =>
    box({ y: front > 0 ? u0 : -u1, d: u1 - u0, ...o });
  //a right hand wheel at position u along the vehicle, x is the wheel's outer face
  const rightWheel = (u, d, x) =>
    box({
      x,
      y: front * u - d / 2,
      w: 7,
      d,
      h: d,
      t: "#0b0b0f",
      f: "#0b0b0f",
      r: "#1d1d24",
    });
  const shadow = (w, l) =>
    `<i class="face vshadow" style="left:${-(w + 16) / 2}px;top:${-(l + 16) / 2}px;width:${w + 16}px;height:${l + 16}px"></i>`;

  if (kind === "truck") {
    //rigid lorry: 80 wide, 246 long, cab 70 + box 174
    const w = 80;
    const half = 123;
    const wheelX = w / 2 - 3;
    return `<div class="veh">
      ${shadow(w, 246)}
      ${part(-half, half - 72, { x: -w / 2 + 5, z: 12, w: w - 10, h: 18, ...dark })}
      ${part(-half, half - 72, { x: -w / 2, z: 30, w, h: 85, t: "#d5d8e4", f: `${front > 0 ? "" : band + ","}linear-gradient(90deg,transparent 49.5%,rgba(0,0,0,.3) 49.5% 50.5%,transparent 50.5%),#aeb2c4`, r: `linear-gradient(90deg,#9da1b5 0 58%,${colour} 58% 70%,#9da1b5 70%)` })}
      ${part(half - 70, half, { x: -w / 2, z: 12, w, h: 78, t: colour, f: front > 0 ? `${band},linear-gradient(180deg,#2a2a35 0 30%,${glass} 30%)` : colour, r: colour })}
      ${rightWheel(half - 35, 34, wheelX)}
      ${rightWheel(-half + 38, 34, wheelX)}
    </div>`;
  }

  if (kind === "semi") {
    //articulated lorry: 82 wide, 480 long, tractor 150 + trailer 340
    const w = 82;
    const half = 240;
    const wheelX = w / 2 - 3;
    return `<div class="veh">
      ${shadow(w, 480)}
      ${part(60, half - 76, { x: -w / 2 + 6, z: 14, w: w - 12, h: 22, ...dark })}
      ${part(-half, 100, { x: -w / 2, z: 36, w, h: 92, t: "#d5d8e4", f: `${front > 0 ? "" : band + ","}linear-gradient(90deg,transparent 49.5%,rgba(0,0,0,.3) 49.5% 50.5%,transparent 50.5%),#aeb2c4`, r: `linear-gradient(90deg,#9da1b5 0 52%,${colour} 52% 66%,#9da1b5 66%)` })}
      ${part(half - 76, half, { x: -w / 2 + 1, z: 14, w: w - 2, h: 86, t: colour, f: front > 0 ? `${band},linear-gradient(180deg,#2a2a35 0 30%,${glass} 30%)` : colour, r: colour })}
      ${rightWheel(half - 36, 34, wheelX)}
      ${rightWheel(105, 34, wheelX)}
      ${rightWheel(78, 34, wheelX)}
      ${rightWheel(-190, 34, wheelX)}
      ${rightWheel(-162, 34, wheelX)}
    </div>`;
  }

  //cars
  const s = CARS[kind] || CARS.sedan;
  const half = s.l / 2;
  const cabCentre = -front * s.shift;
  return `<div class="veh">
    ${shadow(s.w, s.l)}
    ${box({ x: -s.w / 2, y: -half, z: 6, w: s.w, d: s.l, h: s.body, t: colour, f: `${band},${colour}`, k: `${bandOther},${colour}`, r: colour })}
    ${box({ x: -s.cabW / 2, y: cabCentre - s.cabL / 2, z: 6 + s.body, w: s.cabW, d: s.cabL, h: s.cab, t: colour, f: glass, r: "linear-gradient(90deg,#0d1f3f,#2a4a85)" })}
    ${rightWheel(half - 30, 22, s.w / 2 - 2)}
    ${rightWheel(-half + 30, 22, s.w / 2 - 2)}
  </div>`;
};

//each lane keeps one speed so its vehicles never run into each other.
//k is the vehicle's speed relative to the scrolling scenery: same direction
//traffic is slower than the car (k < 1), oncoming traffic is faster (k > 1)
const TRAFFIC = [
  { x: LANE_B, front: 1, k: 0.4, count: 3, kinds: ["sedan", "semi", "suv"] },
  {
    x: LANE_C,
    front: -1,
    k: 1.7,
    count: 4,
    kinds: ["hatch", "sedan", "truck", "suv"],
  },
  { x: LANE_D, front: -1, k: 1.5, count: 3, kinds: ["truck", "sedan", "semi"] },
];
/* ---------- overhead signs ---------- */

const GANTRY_COUNT = 2;
const GANTRY_RING = RING;

const paintSign = (lines) => (ctx, w, h) => {
  ctx.fillStyle = "#0b6b3b";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, w - 10, h - 10);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 13px Arial, sans-serif";
  ctx.fillText(lines[0], w / 2, 25);
  ctx.font = "900 24px 'Arial Black', Arial, sans-serif";
  ctx.fillText(lines[1], w / 2, 54);
  ctx.font = "bold 13px Arial, sans-serif";
  ctx.fillText(lines[2], w / 2, 71);
};

//a sign gantry over the oncoming carriageway, signs facing the oncoming drivers (+y).
//The truss is high enough for the tallest lorry to pass under.
const gantryHTML = () => {
  const metal = { t: "#6d6a7c", f: "#4a4858", r: "#363444" };
  const x0 = LANE_D - 50;
  const x1 = MEDIAN_L + 4;
  return `<div class="gantry">
    ${box({ x: x1 - 4, y: -3, w: 6, d: 6, h: 140, ...metal })}
    ${box({ x: x0 - 4, y: -3, w: 6, d: 6, h: 140, ...metal })}
    ${box({ x: x0 - 4, y: -3, z: 130, w: x1 - x0 + 10, d: 6, h: 8, ...metal })}
    <i class="face sign" style="left:${LANE_D - 35}px;top:3.2px;width:70px;height:31px;transform:translateZ(130px) rotateX(-90deg);--tex:var(--tex-sign0)"></i>
    <i class="face sign" style="left:${LANE_C - 35}px;top:3.2px;width:70px;height:31px;transform:translateZ(130px) rotateX(-90deg);--tex:var(--tex-sign1)"></i>
  </div>`;
};
/* ---------- sidewalk life ---------- */

//the pavement beside the highway nearest the camera (+x). Props are placed in zones
//so nothing tall stands close enough to the road to hide the car:
//  58-68 hydrants and bins, 72-104 the walking lane, 110-150 stalls and benches,
//  156-192 trees, kiosks and bus shelters
const WALK_L = HWY_RIGHT;
const WALK_R = 196;
const WALK_W = WALK_R - WALK_L;

const SKIN = ["#f1c9a5", "#d9a066", "#a8714a", "#6b4229", "#e8b98f"];
const SHIRTS = [
  "#e63946",
  "#2a6df4",
  "#f2b31c",
  "#1fb36b",
  "#8a2be2",
  "#d94a8c",
  "#f4f4f8",
  "#ff7f11",
  "#2ec4b6",
];
const PANTS = ["#23233a", "#3b3b5c", "#4a3b2a", "#1d3b5c", "#2a2a2a"];

const STALLS = [
  { text: "TACOS", colour: "#e85d2a" },
  { text: "HOT DOGS", colour: "#c0392b" },
  { text: "NOODLES", colour: "#2c8f5a" },
  { text: "COFFEE", colour: "#6b4226" },
  { text: "KEBAB", colour: "#d9962b" },
  { text: "CHURROS", colour: "#c2185b" },
  { text: "NEWS", colour: "#2a6df4" },
  { text: "FLOWERS", colour: "#d94a8c" },
];

const paintStallSign = (text, colour) => (ctx, w, h) => {
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.font = "900 26px Impact, 'Arial Black', sans-serif";
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.strokeText(text, w / 2, 29);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, w / 2, 29);
};

const paintBusSign = (ctx, w, h) => {
  ctx.fillStyle = "#1a56c8";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "900 17px Impact, Arial, sans-serif";
  ctx.fillText("BUS", w / 2, 22);
  ctx.font = "bold 9px Arial, sans-serif";
  ctx.fillText("STOP", w / 2, 33);
  ctx.fillStyle = "#ff3030";
  ctx.fillRect(10, 37, w - 20, 5);
};

const paintParkSign = (ctx, w, h) => {
  ctx.fillStyle = "#1a56c8";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "900 34px Impact, Arial, sans-serif";
  ctx.fillText("P", w / 2, 36);
};

const solid = (c) => ({ t: c, f: c, r: c });

//a pedestrian about 1.6 m tall, centred on the origin
const personHTML = (shirt, pants, skin) => `<div class="person">
  ${box({ x: -3.5, y: -2, w: 7, d: 4, h: 13, ...solid(pants) })}
  ${box({ x: -4, y: -2.5, z: 13, w: 8, d: 5, h: 14, ...solid(shirt) })}
  ${box({ x: 4, y: -1.5, z: 14, w: 2.5, d: 3, h: 11, ...solid(shirt) })}
  ${box({ x: -2.5, y: -2.5, z: 27, w: 5, d: 5, h: 5.5, ...solid(skin) })}
  ${box({ x: -2.7, y: -2.7, z: 31.5, w: 5.4, d: 5.4, h: 2, ...solid("#2a1a10") })}
</div>`;

const randomPerson = () => personHTML(pick(SHIRTS), pick(PANTS), pick(SKIN));

//a street food stall with a striped awning, facing +y (towards the camera)
const stallHTML = (i) => {
  const { colour } = STALLS[i];
  const metal = solid("#4a4a5a");
  const stripes = `repeating-linear-gradient(90deg,#fff 0 6px,${colour} 6px 12px)`;
  return `<div class="prop">
    <i class="face pshadow" style="left:-34px;top:-30px;width:68px;height:60px"></i>
    <i class="face glow" style="left:-45px;top:-18px"></i>
    ${box({ x: -20, y: -13, w: 40, d: 26, h: 14, t: "#d8d4cc", f: colour, r: colour })}
    ${box({ x: -17, y: 6, z: 14, w: 7, d: 6, h: 5, t: "#ffd166", f: "#e0a030", r: "#b88020" })}
    ${box({ x: -5, y: 6, z: 14, w: 7, d: 6, h: 4, t: "#e63946", f: "#b02a36", r: "#8a1f2a" })}
    ${box({ x: 8, y: 6, z: 14, w: 8, d: 6, h: 6, t: "#f4f4f8", f: "#c8c8d2", r: "#a0a0ac" })}
    <div class="at" style="transform:translate3d(0px,-4px,0)">${randomPerson()}</div>
    ${box({ x: -23, y: 15, w: 2, d: 2, h: 44, ...metal })}
    ${box({ x: 21, y: 15, w: 2, d: 2, h: 44, ...metal })}
    ${box({ x: -23, y: -16, w: 2, d: 2, h: 44, ...metal })}
    ${box({ x: 21, y: -16, w: 2, d: 2, h: 44, ...metal })}
    ${box({ x: -25, y: -18, z: 44, w: 50, d: 36, h: 2.5, t: stripes, f: stripes, r: stripes })}
    <i class="face signboard" style="left:-19px;top:18.4px;width:38px;height:9.5px;transform:translateZ(43px) rotateX(-90deg);--tex:var(--tex-stall${i})"></i>
  </div>`;
};

//a food cart under an umbrella
const cartHTML = (i) => {
  const { colour } = STALLS[i];
  const stripes = `repeating-linear-gradient(90deg,#fff 0 6px,${colour} 6px 12px)`;
  return `<div class="prop">
    <i class="face pshadow" style="left:-30px;top:-26px;width:60px;height:52px"></i>
    <i class="face glow" style="left:-45px;top:-30px"></i>
    ${box({ x: 14, y: -7, w: 3, d: 10, h: 10, ...solid("#1b1b22") })}
    ${box({ x: 14, y: 0, w: 3, d: 10, h: 10, ...solid("#1b1b22") })}
    ${box({ x: -14, y: -9, z: 7, w: 28, d: 18, h: 10, t: "#cfcfd8", f: colour, r: colour })}
    ${box({ x: -12, y: -7, z: 17, w: 24, d: 14, h: 2, ...solid("#9aa0aa") })}
    ${box({ x: -8, y: 1, z: 19, w: 6, d: 5, h: 4, t: "#e8a33a", f: "#b8802a", r: "#8a6020" })}
    ${box({ x: 2, y: 1, z: 19, w: 6, d: 5, h: 3, t: "#d94a3a", f: "#a8382c", r: "#80281f" })}
    <div class="at" style="transform:translate3d(0px,-14px,0)">${randomPerson()}</div>
    ${box({ x: -1, y: -1, z: 19, w: 2, d: 2, h: 30, ...solid("#4a4a5a") })}
    ${box({ x: -22, y: -22, z: 49, w: 44, d: 44, h: 2, t: stripes, f: stripes, r: stripes })}
    ${box({ x: -12, y: -12, z: 51, w: 24, d: 24, h: 2, t: stripes, f: stripes, r: stripes })}
    <i class="face signboard" style="left:-14px;top:9.4px;width:28px;height:7px;transform:translateZ(24px) rotateX(-90deg);--tex:var(--tex-stall${i})"></i>
  </div>`;
};

const treeHTML = () => `<div class="prop">
  <i class="face pshadow" style="left:-24px;top:-22px;width:48px;height:44px"></i>
  ${box({ x: -12, y: -12, w: 24, d: 24, h: 5, t: "#8d8a98", f: "#6c6a78", r: "#55535f" })}
  ${box({ x: -2.5, y: -2.5, z: 5, w: 5, d: 5, h: 30, t: "#6b4a30", f: "#54381f", r: "#3f2a17" })}
  ${box({ x: -17, y: -17, z: 32, w: 34, d: 34, h: 16, t: "#4aa85a", f: "#2f7d3e", r: "#1f5a2b" })}
  ${box({ x: -11, y: -11, z: 48, w: 22, d: 22, h: 12, t: "#5cc16c", f: "#3a9449", r: "#287036" })}
</div>`;

const benchHTML = () => `<div class="prop">
  <i class="face pshadow" style="left:-12px;top:-22px;width:24px;height:44px"></i>
  ${box({ x: -4, y: -17, w: 2, d: 2, h: 9, ...solid("#3a3a48") })}
  ${box({ x: -4, y: 15, w: 2, d: 2, h: 9, ...solid("#3a3a48") })}
  ${box({ x: -5, y: -18, z: 9, w: 11, d: 36, h: 3, t: "#a06a3c", f: "#7a4e2a", r: "#6a4224" })}
  ${box({ x: 3, y: -18, z: 12, w: 3, d: 36, h: 11, t: "#a06a3c", f: "#7a4e2a", r: "#8a5a32" })}
</div>`;

const binHTML = () => `<div class="prop">
  ${box({ x: -5.5, y: -5.5, w: 11, d: 11, h: 18, t: "#2f5d46", f: "#244a37", r: "#1b3a2a" })}
  ${box({ x: -6.5, y: -6.5, z: 18, w: 13, d: 13, h: 3, ...solid("#1c1c24") })}
</div>`;

const hydrantHTML = () => `<div class="prop">
  ${box({ x: -3, y: -3, w: 6, d: 6, h: 14, t: "#e03a3a", f: "#b82a2a", r: "#8a1f1f" })}
  ${box({ x: -4, y: -4, z: 14, w: 8, d: 8, h: 3.5, t: "#ef5a5a", f: "#c83a3a", r: "#9a2a2a" })}
  ${box({ x: 3, y: -1.5, z: 7, w: 3, d: 3, h: 3, ...solid("#c83a3a") })}
</div>`;

//a newspaper / flower kiosk with a window on the +y face
const kioskHTML = (i) => {
  const { colour } = STALLS[i];
  const front = `linear-gradient(#ffe2a8,#ffb86b) 50% 70% / 70% 38% no-repeat, ${colour}`;
  return `<div class="prop">
    <i class="face pshadow" style="left:-30px;top:-26px;width:60px;height:52px"></i>
    <i class="face glow" style="left:-45px;top:-18px"></i>
    ${box({ x: -22, y: -17, w: 44, d: 34, h: 36, t: colour, f: front, r: colour })}
    ${box({ x: -25, y: -20, z: 36, w: 50, d: 40, h: 4, t: "#2a2a36", f: "#1c1c26", r: "#14141c" })}
    <i class="face signboard" style="left:-20px;top:17.2px;width:40px;height:10px;transform:translateZ(35px) rotateX(-90deg);--tex:var(--tex-stall${i})"></i>
  </div>`;
};

//a bus shelter whose back (facing the camera) carries a game poster
const shelterHTML = () => {
  const metal = solid("#3a3a48");
  return `<div class="prop">
    <i class="face pshadow" style="left:-24px;top:-52px;width:48px;height:104px"></i>
    ${box({ x: -14, y: -45, w: 3, d: 3, h: 50, ...metal })}
    ${box({ x: -14, y: 42, w: 3, d: 3, h: 50, ...metal })}
    ${box({ x: 11, y: -45, z: 8, w: 3, d: 90, h: 42, t: "#2a2a36", f: "#1c1c26", r: "#8fb4c8" })}
    ${box({ x: -14, y: -45, z: 50, w: 28, d: 90, h: 3, t: "#2a2a36", f: "#1c1c26", r: "#14141c" })}
    ${box({ x: 0, y: -24, z: 9, w: 9, d: 48, h: 3, t: "#a06a3c", f: "#7a4e2a", r: "#6a4224" })}
    <i class="face poster ad" style="left:14.2px;top:26px;width:52px;height:36px;transform:translateZ(46px) rotateY(90deg) rotateZ(-90deg)"></i>
  </div>`;
};

//a bus stop sign on a pole, with the route flag facing the camera
const busSignHTML = () => `<div class="prop">
  ${box({ x: -1, y: -1, w: 2, d: 2, h: 52, ...solid("#4a4a5a") })}
  <i class="face signboard" style="left:-8px;top:1.2px;width:16px;height:16px;transform:translateZ(52px) rotateX(-90deg);--tex:var(--tex-bus)"></i>
</div>`;

//a parking meter
const meterHTML = () => `<div class="prop">
  ${box({ x: -1, y: -1, w: 2, d: 2, h: 16, ...solid("#4a4a5a") })}
  ${box({ x: -2.5, y: -2, z: 16, w: 5, d: 4, h: 7, t: "#2a6df4", f: "#1f55c0", r: "#173f94" })}
</div>`;

//a surface car park beside the sidewalk: painted bays, parked cars, a pay machine,
//charging posts and a P sign. Cars are parked nose towards the road.
const CP_X = 205;
const CP_CX = CP_X + 60; //local origin: the middle of the lot
const CP_W = 120;
const CP_LEN = 440;
const CP_BAY = 55;
const carparkHTML = () => {
  const bays = CP_LEN / CP_BAY;
  let cars = "";
  for (let i = 0; i < bays; i++) {
    if (Math.random() < 0.3) continue;
    const kind = pick(["hatch", "sedan", "sedan", "suv"]);
    const cy = -CP_LEN / 2 + CP_BAY * (i + 0.5) + rnd(-2, 2);
    cars += `<div class="at" style="transform:translate3d(${r2(57 - 60 + rnd(-3, 3))}px,${r2(cy)}px,0) rotateZ(${r2(90 + rnd(-2, 2))}deg) scale3d(${VEH_SCALE},${VEH_SCALE},${VEH_SCALE})">${vehicleHTML(kind, pick(CAR_COLOURS), 1)}</div>`;
  }
  const metal = solid("#4a4a5a");
  return `<div class="prop">
    <i class="face lot" style="left:${-CP_W / 2}px;top:${-CP_LEN / 2}px;width:${CP_W}px;height:${CP_LEN}px"></i>
    ${cars}
    ${box({ x: -56, y: -CP_LEN / 2 + 8, w: 8, d: 6, h: 24, t: "#2a6df4", f: "#1f55c0", r: "#173f94" })}
    ${box({ x: -54, y: -50, w: 5, d: 5, h: 22, t: "#2fe08a", f: "#1fa866", r: "#188050" })}
    ${box({ x: -54, y: 110, w: 5, d: 5, h: 22, t: "#2fe08a", f: "#1fa866", r: "#188050" })}
    ${box({ x: -58, y: -CP_LEN / 2 - 6, w: 2, d: 2, h: 44, ...metal })}
    <i class="face signboard" style="left:-66px;top:${-CP_LEN / 2 - 3.8}px;width:16px;height:16px;transform:translateZ(44px) rotateX(-90deg);--tex:var(--tex-park)"></i>
  </div>`;
};
const buildProp = (kind, variant) => {
  switch (kind) {
    case "stall":
      return stallHTML(variant);
    case "cart":
      return cartHTML(variant);
    case "tree":
      return treeHTML();
    case "bench":
      return benchHTML();
    case "bin":
      return binHTML();
    case "hydrant":
      return hydrantHTML();
    case "kiosk":
      return kioskHTML(variant);
    case "bussign":
      return busSignHTML();
    case "meter":
      return meterHTML();
    case "carpark":
      return carparkHTML();
    default:
      return shelterHTML();
  }
};

//kind, lateral x, position along the ring, variant, tallest height (for culling),
//and how far it reaches along the road either side of its position
const PROPS = [
  ["stall", 128, 0, 0, 50, 0],
  ["tree", 172, 70, 0, 62, 0],
  ["meter", 64, 110, 0, 24, 0],
  ["meter", 64, 150, 0, 24, 0],
  ["carpark", 265, 240, 0, 40, 240],
  ["bussign", 64, 300, 0, 52, 0],
  ["bench", 118, 330, 0, 24, 0],
  ["shelter", 170, 360, 0, 53, 0],
  ["cart", 132, 470, 1, 54, 0],
  ["tree", 172, 540, 0, 62, 0],
  ["bin", 64, 610, 0, 21, 0],
  ["kiosk", 168, 700, 6, 40, 0],
  ["hydrant", 64, 720, 0, 18, 0],
  ["meter", 64, 770, 0, 24, 0],
  ["meter", 64, 810, 0, 24, 0],
  ["tree", 172, 880, 0, 62, 0],
  ["carpark", 265, 1100, 0, 40, 240],
  ["bussign", 64, 1000, 0, 52, 0],
  ["bench", 118, 1030, 0, 24, 0],
  ["shelter", 170, 1060, 0, 53, 0],
  ["tree", 172, 1160, 0, 62, 0],
  ["cart", 132, 1230, 3, 54, 0],
  ["bin", 64, 1300, 0, 21, 0],
  ["kiosk", 168, 1380, 7, 40, 0],
  ["tree", 172, 1460, 0, 62, 0],
  ["bussign", 64, 1540, 0, 52, 0],
  ["bench", 118, 1570, 0, 24, 0],
  ["shelter", 170, 1600, 0, 53, 0],
  ["hydrant", 64, 1700, 0, 18, 0],
  ["meter", 64, 1740, 0, 24, 0],
  ["meter", 64, 1780, 0, 24, 0],
];

const PED_COUNT = 9;

//true while a point of the scene could be on screen (h = how tall it stands,
//reach = how far it extends along the road)
const inView = (x, y, h, reach = 0) => {
  const xy = x + y;
  return (
    xy > -700 - reach &&
    xy < 520 + 2 * h + reach &&
    Math.abs(x - y) < 620 + reach
  );
};
class FnSupercar extends HTMLElement {
  static observedAttributes = ["speed", "color", "paused"];

  constructor() {
    super();
    this.speedValue = 320;
    this.offset = 0;
    this.time = 0;
    this.last = 0;
    this.frame = 0;
    this.visible = true;
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    if (!this.built) {
      this.build();
      this.built = true;
    }
    this.readAttributes();

    this.resizer = new ResizeObserver(() => this.fit());
    this.resizer.observe(this);
    this.fit();

    this.watcher = new IntersectionObserver((entries) => {
      this.visible = entries.some((entry) => entry.isIntersecting);
      this.restart();
    });
    this.watcher.observe(this);

    this.onVisibility = () => this.restart();
    document.addEventListener("visibilitychange", this.onVisibility);
    this.restart();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.resizer?.disconnect();
    this.watcher?.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  attributeChangedCallback() {
    if (this.built) {
      this.readAttributes();
      this.restart();
    }
  }

  readAttributes() {
    const speed = Number(this.getAttribute("speed"));
    this.speedValue = speed > 0 ? speed : 320;
    const color = this.getAttribute("color");
    if (color) this.style.setProperty("--body", color);
    //wheel rotation matched to the road speed (circumference / speed)
    this.style.setProperty(
      "--spin",
      r2((Math.PI * 2 * 12) / this.speedValue) + "s",
    );
  }

  build() {
    const style = document.createElement("style");
    style.textContent = `
      :host {
        --body: #f2f2f6;
        --body-hi: color-mix(in srgb, var(--body) 80%, white);
        --body-lo: color-mix(in srgb, var(--body) 68%, black);
        --spin: 0.25s;
        display: block;
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 10;
        overflow: hidden;
        border-radius: 0.75rem;
        background: #12031f;
      }
      *, *::before, *::after { box-sizing: border-box; }
      i, b { display: block; }

      /* ---------- iso stage ---------- */
      .stage {
        position: absolute;
        left: 50%;
        top: 60%;
        width: 0;
        height: 0;
        transform: scale(var(--s, 1));
      }
      .world {
        position: absolute;
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        transform-style: preserve-3d;
        transform: rotateX(55deg) rotateZ(45deg);
      }

      .face { position: absolute; }

      .clip { overflow: hidden; }
      .scroll {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: calc(100% + var(--p, 0px));
        background-image: var(--tex);
      }

      /* ---------- highway ---------- */
      .ground {
        left: -900px;
        top: -900px;
        width: 1800px;
        height: 1800px;
        background: #42404f;
      }
      .hwy {
        left: ${HWY_LEFT}px;
        top: -900px;
        width: ${HWY_W}px;
        height: 1800px;
        overflow: hidden;
        transform: translateZ(1px);
        background: #2e2d38;
      }
      .hwy .layer { position: absolute; inset: 0; }
      .hwy .lane {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 3px;
      }
      .scroll.dash {
        background-image: repeating-linear-gradient(180deg, #e6e6ee 0 24px, transparent 24px 72px);
      }

      /* concrete median barrier: a flat top and a ribbed side facing the camera */
      .mtop {
        left: ${MEDIAN_L}px;
        top: -900px;
        width: ${MEDIAN_R - MEDIAN_L}px;
        height: 1800px;
        transform: translateZ(${MEDIAN_H}px);
        background: #b9b6c4;
      }
      .mside {
        left: ${MEDIAN_R}px;
        top: -900px;
        width: ${MEDIAN_H}px;
        height: 1800px;
        transform-origin: 0 0;
        transform: rotateY(-90deg);
        background: linear-gradient(90deg, #7c7988, #a8a5b5 45%, #9794a6);
      }
      .scroll.joint {
        background-image: repeating-linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0 2px, transparent 2px 60px);
      }

      /* steel guardrails along both outer edges (a vertical plane facing +x) */
      .rail {
        top: -900px;
        width: 16px;
        height: 1800px;
        transform-origin: 0 0;
        transform: rotateY(-90deg);
        background: linear-gradient(90deg, #3a3a46 0 5px, #aeb0bc 5px 7px, #e4e6ee 7px 9px, #aeb0bc 9px 11px, #3a3a46 11px);
      }
      .scroll.posts {
        background-image: repeating-linear-gradient(180deg, rgba(10, 10, 18, 0.65) 0 3px, transparent 3px 40px);
      }
      /* ---------- lamps ---------- */
      .lamps, .lamps .slot, .lamps .shift {
        position: absolute;
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        transform-style: preserve-3d;
      }
      .pool {
        width: 90px;
        height: 90px;
        transform: translateZ(2px);
        background: radial-gradient(circle, rgba(255, 170, 240, 0.35), transparent 70%);
      }

      /* ---------- sidewalk ---------- */
      .walk {
        left: ${HWY_RIGHT}px;
        top: -900px;
        width: ${WALK_R - HWY_RIGHT}px;
        height: 1800px;
        overflow: hidden;
        transform: translateZ(1px);
        background: #6f6c80;
      }
      .walk .kerb {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 4px;
        background: linear-gradient(90deg, #9a97a8, #cbc8d6);
      }
      .walk .kerb.l { left: 0; }
      .walk .kerb.r { right: 0; }
      .props, .prop, .at, .peds, .ped, .person {
        position: absolute;
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        transform-style: preserve-3d;
      }
      .person { animation: step 0.45s ease-in-out infinite alternate; }
      .pshadow {
        transform: translateZ(1.6px);
        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.5) 35%, transparent 72%);
      }
      .glow {
        width: 90px;
        height: 70px;
        transform: translateZ(1.8px);
        background: radial-gradient(ellipse at center, rgba(255, 190, 110, 0.3), transparent 70%);
      }
      .lot {
        transform: translateZ(1.2px);
        background:
          repeating-linear-gradient(180deg, #e6e6ee 0 2px, transparent 2px 55px) 5px 0 / 107px 100% no-repeat,
          linear-gradient(90deg, #e6e6ee, #e6e6ee) 110px 0 / 2px 100% no-repeat,
          var(--tex-asphalt);
        box-shadow: inset 0 0 0 2px #8d8a9a;
      }
      .signboard {
        transform-origin: 0 0;
        backface-visibility: hidden;
        background-image: var(--tex);
        background-size: 100% 100%;
      }
      /* ---------- tower blocks ---------- */
      .buildings, .bldslot, .traffic, .veh, .gantries, .gantry {
        position: absolute;
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        transform-style: preserve-3d;
      }
      .bld {
        --roof: #15132a;
        --wall: #2b2a4a;
        --lit: #ffd98a;
        --lit2: #ffa65a;
        --p1: 24px;
        --facade-f:
          repeating-linear-gradient(180deg, transparent 0 var(--p1), var(--wall) var(--p1) calc(var(--p1) + 9px)),
          repeating-linear-gradient(180deg, transparent 0 5px, var(--wall) 5px 9px),
          repeating-linear-gradient(90deg, transparent 0 6px, var(--wall) 6px 10px),
          linear-gradient(180deg, var(--lit), var(--lit2));
        --facade-r:
          repeating-linear-gradient(90deg, transparent 0 var(--p1), var(--wall) var(--p1) calc(var(--p1) + 9px)),
          repeating-linear-gradient(90deg, transparent 0 5px, var(--wall) 5px 9px),
          repeating-linear-gradient(180deg, transparent 0 6px, var(--wall) 6px 10px),
          linear-gradient(90deg, var(--lit), var(--lit2));
      }
      .bld .r { filter: brightness(0.62); }
      .bld .t { box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.14); }

      /* ---------- traffic and signs ---------- */
      .vshadow {
        transform: translateZ(2px);
        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.55) 35%, transparent 72%);
      }
      .sign {
        transform-origin: 0 0;
        backface-visibility: hidden;
        background-image: var(--tex);
        background-size: 100% 100%;
        box-shadow: 0 0 10px 1px rgba(255, 255, 255, 0.18);
      }
      /* ---------- billboards ---------- */
      .billboards, .bb {
        position: absolute;
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        transform-style: preserve-3d;
      }
      .poster {
        transform-origin: 0 0;
        /* the camera must never see a poster from behind (it would be mirrored) */
        backface-visibility: hidden;
        background-image: var(--tex);
        background-size: 100% 100%;
        box-shadow: 0 0 14px 2px rgba(255, 255, 255, 0.25);
      }
      .bbglow {
        width: 160px;
        height: 160px;
        transform: translateZ(2px);
        background: radial-gradient(circle, rgba(170, 130, 255, 0.28), transparent 70%);
      }

      /* ---------- generic cuboid ---------- */
      .box {
        position: absolute;
        width: var(--w);
        height: var(--d);
        transform-style: preserve-3d;
      }
      .box > i { position: absolute; }
      .box .t {
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background: var(--ct);
        transform: translateZ(var(--h));
      }
      .box .f {
        left: 0;
        top: var(--d);
        width: var(--w);
        height: var(--h);
        background: var(--cf);
        transform-origin: 50% 0;
        transform: rotateX(90deg);
      }
      .box .k {
        left: 0;
        top: 0;
        width: var(--w);
        height: var(--h);
        background: var(--ck);
        transform-origin: 50% 0;
        transform: rotateX(90deg);
      }
      .box .r {
        left: var(--w);
        top: 0;
        width: var(--h);
        height: var(--d);
        background: var(--cr);
        transform-origin: 0 50%;
        transform: rotateY(-90deg);
      }

      /* ---------- the car ---------- */
      .car {
        position: absolute;
        left: -${CAR_W / 2}px;
        top: -${CAR_L / 2}px;
        width: ${CAR_W}px;
        height: ${CAR_L}px;
        transform-style: preserve-3d;
      }
      .flip {
        position: absolute;
        inset: 0;
        transform-style: preserve-3d;
        /* model is authored facing -y; mirror it so the car drives towards +y */
        transform: scaleY(-1);
      }
      .body {
        position: absolute;
        inset: 0;
        transform-style: preserve-3d;
        animation: bob 0.16s ease-in-out infinite alternate;
      }
      .shadow {
        left: -10px;
        top: -8px;
        width: ${CAR_W + 20}px;
        height: ${CAR_L + 20}px;
        transform: translateZ(2px);
        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.7) 30%, transparent 72%);
      }
      .beam {
        left: 8px;
        top: -120px;
        width: ${CAR_W - 16}px;
        height: 120px;
        transform: translateZ(2.5px);
        background: linear-gradient(0deg, rgba(255, 245, 190, 0.45), transparent);
        clip-path: polygon(30% 100%, 70% 100%, 100% 0, 0 0);
      }
      .trail {
        top: ${CAR_L - 2}px;
        width: 8px;
        height: 170px;
        transform: translateZ(3px);
        background: linear-gradient(180deg, rgba(255, 50, 50, 0.8), transparent);
        animation: flicker 0.12s steps(2) infinite alternate;
      }

      .side { transform-origin: 0 0; transform: rotateY(-90deg); }
      .slab, .nose { transform-origin: 50% 0; }
      .circ { position: absolute; border-radius: 50%; transform-origin: 0 0; }

      /* side panel: dark sill, then body colour shading upwards (local x = z) */
      .panel {
        background: linear-gradient(90deg, #121212 0 6px, var(--body-lo) 6px, var(--body) 55%, var(--body-hi) 100%);
      }
      .sill { background: #0e0e12; }
      .cut { background: #1a1a22; }
      /* the five side strakes: black slots between body coloured fins (local x = z) */
      .strakes {
        background: repeating-linear-gradient(90deg, #0b0b10 0 2.5px, var(--body-lo) 2.5px 5px);
      }
      .cabin {
        background: linear-gradient(180deg, #0a1426 0, #1c3a6a 26px, #0a1426 44px, #0a1426 58px, var(--body-lo) 58px);
      }
      .nose {
        background:
          radial-gradient(circle 2px at 5px 3.4px, #ffb347 0 65%, transparent 75%),
          radial-gradient(circle 2px at 59px 3.4px, #ffb347 0 65%, transparent 75%),
          radial-gradient(circle 1.5px at 32px 3.4px, #ffc832 0 70%, transparent 80%),
          repeating-linear-gradient(90deg, #000 0 2px, #3a3a44 2px 4px) 18px 2.2px / 28px 2.6px no-repeat,
          linear-gradient(180deg, #070707 0 38%, var(--body) 38%);
      }
      /* hood with the flip up headlight lids at the corners (the nose is at the top) */
      .hood {
        background:
          linear-gradient(#2a2a32, #2a2a32) 12% 4px / 22% 11px no-repeat,
          linear-gradient(#2a2a32, #2a2a32) 88% 4px / 22% 11px no-repeat,
          linear-gradient(90deg, transparent 49.2%, rgba(0, 0, 0, 0.18) 49.2% 50.8%, transparent 50.8%),
          linear-gradient(180deg, var(--body-hi), var(--body));
      }
      .deck { background: linear-gradient(180deg, var(--body), var(--body-lo)); }
      .roof { background: linear-gradient(180deg, var(--body-hi), var(--body)); }
      .glass {
        background:
          linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.22) 46% 52%, transparent 58%),
          linear-gradient(180deg, #0b1630, #04070f);
      }
      .louvres {
        background: repeating-linear-gradient(180deg, #050505 0 2px, #2b2b2b 2px 3.5px);
        box-shadow: inset 0 0 0 1px #000;
      }

      .arch { background: #050005; }
      .wheel {
        background: radial-gradient(circle, #eceff4 0 14%, #a9afbd 15% 54%, #0c0c0c 56% 100%);
      }
      /* the five spoke star wheel */
      .spin {
        position: absolute;
        inset: 14%;
        border-radius: 50%;
        background: repeating-conic-gradient(rgba(12, 12, 12, 0.92) 0 22deg, transparent 22deg 72deg);
        animation: spin var(--spin) linear infinite;
      }
      /* ---------- screen space overlay ---------- */
      .vignette {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(ellipse at 50% 55%, transparent 55%, rgba(5, 0, 15, 0.65));
      }

      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes bob { from { transform: translateZ(0); } to { transform: translateZ(0.8px); } }
      @keyframes step { from { transform: translateZ(0); } to { transform: translateZ(1.4px); } }
      @keyframes flicker { from { opacity: 0.65; } to { opacity: 1; } }

      @media (prefers-reduced-motion: reduce) {
        .body, .trail, .spin, .person { animation: none; }
      }
    `;

    //lamps along the median
    let lamps = "";
    for (let i = 0; i < LAMP_COUNT; i++)
      lamps += `<div class="slot">${lampHTML(0)}</div>`;

    //billboards on both sides of the road, all facing it
    let billboards = "";
    for (let i = 0; i < BB_COUNT; i++) {
      billboards += billboardHTML("L") + billboardHTML("R");
    }

    //tower blocks, one row each side of the highway
    let buildings = "";
    for (let i = 0; i < BLD_COUNT * 2; i++) buildings += buildingHTML();

    //traffic: remember each vehicle's lane and speed for the animation loop
    let traffic = "";
    const trafficMeta = [];
    TRAFFIC.forEach((lane) => {
      for (let i = 0; i < lane.count; i++) {
        const kind = lane.kinds[i % lane.kinds.length];
        traffic += vehicleHTML(
          kind,
          pick(
            kind === "truck" || kind === "semi" ? TRUCK_COLOURS : CAR_COLOURS,
          ),
          lane.front,
        );
        trafficMeta.push({
          x: lane.x,
          k: lane.k,
          base: (i * RING) / lane.count,
        });
      }
    });

    //street life on the sidewalk nearest the camera
    let props = "";
    PROPS.forEach(([kind, , , variant]) => (props += buildProp(kind, variant)));
    const pedMeta = [];
    let peds = "";
    for (let i = 0; i < PED_COUNT; i++) {
      peds += `<div class="ped">${randomPerson()}</div>`;
      //half walk with the car, half against it
      pedMeta.push({
        x: rnd(72, 100),
        k: i % 2 ? 1.14 : 0.86,
        base: i * (RING / PED_COUNT) + rnd(0, 60),
      });
    }

    let gantries = "";
    for (let i = 0; i < GANTRY_COUNT; i++) gantries += gantryHTML();

    const scene = document.createElement("div");
    scene.className = "scene";
    scene.innerHTML = `
      <div class="stage">
        <div class="world">
          <div class="face ground clip"><div class="scroll" data-period="128" style="--tex:var(--tex-plaza)"></div></div>
          <div class="face hwy">
            <div class="scroll" data-period="${ASPHALT_TILE}" style="--tex:var(--tex-asphalt)"></div>
            <div class="layer" style="background:${wheelTracks}"></div>
            <div class="layer" style="background:${roadMarks}"></div>
            ${DASH_LEFTS.map((left) => `<div class="clip lane" style="left:${left}px"><div class="scroll dash" data-period="72"></div></div>`).join("")}
          </div>
          <div class="face walk">
            <div class="scroll" data-period="64" style="--tex:var(--tex-walk)"></div>
            <div class="kerb l"></div>
            <div class="kerb r"></div>
          </div>
          <div class="face mtop clip"><div class="scroll joint" data-period="60"></div></div>
          <div class="face mside clip"><div class="scroll joint" data-period="60"></div></div>
          <div class="face rail clip" style="left:${HWY_RIGHT}px"><div class="scroll posts" data-period="40"></div></div>
          <div class="face rail clip" style="left:${HWY_LEFT}px"><div class="scroll posts" data-period="40"></div></div>
          <div class="lamps">${lamps}</div>
          <div class="buildings">${buildings}</div>
          <div class="traffic">${traffic}</div>
          <div class="gantries">${gantries}</div>
          <div class="props">${props}</div>
          <div class="peds">${peds}</div>
          <div class="billboards">${billboards}</div>
          ${carHTML()}
        </div>
      </div>
      <div class="vignette"></div>`;

    //ground and sign textures are painted once and shared through custom properties
    const world = scene.querySelector(".world");
    world.style.setProperty(
      "--tex-asphalt",
      tileTexture(HWY_W, ASPHALT_TILE, paintAsphalt),
    );
    world.style.setProperty(
      "--tex-plaza",
      tileTexture(PLAZA_TILE, PLAZA_TILE, paintPlaza),
    );
    world.style.setProperty("--tex-walk", tileTexture(40, 64, paintSidewalk));
    STALLS.forEach(({ text, colour }, i) =>
      world.style.setProperty(
        `--tex-stall${i}`,
        tileTexture(160, 40, paintStallSign(text, colour)),
      ),
    );
    world.style.setProperty("--tex-bus", tileTexture(48, 48, paintBusSign));
    world.style.setProperty("--tex-park", tileTexture(48, 48, paintParkSign));
    world.style.setProperty(
      "--tex-sign0",
      tileTexture(180, 80, paintSign(["EXIT 14", "CITY CENTRE", "1 MILE"])),
    );
    world.style.setProperty(
      "--tex-sign1",
      tileTexture(180, 80, paintSign(["I-95 NORTH", "AIRPORT", "12 MILES"])),
    );

    this.shadowRoot.append(style, scene);

    this.stage = scene.querySelector(".stage");
    this.carEl = scene.querySelector(".car");
    //layers that scroll by one texture period at a time so they loop seamlessly
    this.scrollers = [...scene.querySelectorAll(".scroll")].map((el) => {
      const period = Number(el.dataset.period);
      el.style.setProperty("--p", period + "px");
      return { el, period };
    });
    this.slots = [...scene.querySelectorAll(".lamps .slot")];

    //tower blocks: the first half stand on the left, the rest on the right
    this.buildings = [...scene.querySelectorAll(".bldslot")].map((el, i) => {
      const side = i < BLD_COUNT ? -1 : 1;
      restyleBuilding(el, side);
      return {
        el,
        side,
        base: (i % BLD_COUNT) * BLD_SPACING + (side > 0 ? BLD_SPACING / 2 : 0),
        last: undefined,
      };
    });
    this.vehicles = [...scene.querySelectorAll(".traffic .veh")].map(
      (el, i) => ({ el, ...trafficMeta[i] }),
    );
    this.gantries = [...scene.querySelectorAll(".gantries .gantry")].map(
      (el, i) => ({ el, base: (i * GANTRY_RING) / GANTRY_COUNT }),
    );

    this.props = [...scene.querySelectorAll(".props > .prop")].map((el, i) => {
      const [, x, base, , h, reach] = PROPS[i];
      return { el, x, base, h, reach, k: 1, on: true };
    });
    this.peds = [...scene.querySelectorAll(".peds > .ped")].map((el, i) => ({
      el,
      h: 38,
      on: true,
      ...pedMeta[i],
    }));

    this.textures = POSTERS.map(makePoster);
    //bus shelter adverts show the game posters too
    scene
      .querySelectorAll(".ad")
      .forEach((el, i) =>
        el.style.setProperty(
          "--tex",
          this.textures[(i + 3) % this.textures.length],
        ),
      );
    this.billboards = [...scene.querySelectorAll(".billboards .bb")].map(
      (el, k) => {
        //even = -x side, odd = +x side, which sits half a gap further along
        const base =
          Math.floor(k / 2) * BB_SPACING + (k % 2) * (BB_SPACING / 2);
        el.style.setProperty("--tex", this.textures[k % this.textures.length]);
        return { el, base, last: undefined };
      },
    );
    this.posterCount = this.billboards.length;
  }
  //scale the fixed size scene to the element
  fit() {
    const width = this.clientWidth;
    if (width > 0 && this.stage) {
      this.stage.style.setProperty("--s", r2(width / DESIGN_WIDTH));
    }
  }

  get running() {
    return this.visible && !document.hidden && !this.hasAttribute("paused");
  }

  restart() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    //always paint at least one frame, even when paused
    this.render();
    if (this.running) {
      this.last = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  tick = (now) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.offset += this.speedValue * dt;
    this.time += dt;
    this.render();
    if (this.running) {
      this.frame = requestAnimationFrame(this.tick);
    }
  };

  render() {
    const s = this.offset;

    //repeating textures scroll by their own period so they loop seamlessly
    this.scrollers.forEach(({ el, period }) => {
      el.style.transform = `translateY(${-(s % period)}px)`;
    });

    const wrap = (value, ring) => (((value % ring) + ring) % ring) - ring / 2;

    //lamps, buildings and signs are fixed to the roadside, so they travel the
    //ring with the road
    this.slots.forEach((slot, i) => {
      slot.style.transform = `translate3d(0,${r2(wrap(i * LAMP_SPACING - s, LAMP_RING))}px,0)`;
    });
    this.gantries.forEach(({ el, base }) => {
      el.style.transform = `translate3d(0,${r2(wrap(base - s, GANTRY_RING))}px,0)`;
    });

    //each time a building wraps round the ring (off screen) it is rebuilt
    //as a different one, so the skyline never repeats
    this.buildings.forEach((b) => {
      const y = wrap(b.base - s, RING);
      if (b.last !== undefined && y > b.last + RING / 2)
        restyleBuilding(b.el, b.side);
      b.last = y;
      b.el.style.transform = `translate3d(0,${r2(y)}px,0)`;
    });

    //traffic moves at its own speed relative to the scenery
    this.vehicles.forEach((v) => {
      v.el.style.transform = `translate3d(${v.x}px,${r2(wrap(v.base - s * v.k, RING))}px,0) scale3d(${VEH_SCALE},${VEH_SCALE},${VEH_SCALE})`;
    });

    //sidewalk props stand still; pedestrians walk, so their speed differs from the
    //scenery. Anything that cannot be on screen is hidden to keep the scene light.
    [...this.props, ...this.peds].forEach((item) => {
      const y = wrap(item.base - s * item.k, RING);
      const on = inView(item.x, y, item.h, item.reach || 0);
      if (on !== item.on) {
        item.on = on;
        item.el.style.display = on ? "" : "none";
      }
      if (on) item.el.style.transform = `translate3d(${item.x}px,${r2(y)}px,0)`;
    });

    //billboards: each time one wraps round the ring (off screen) it gets the
    //next poster so the adverts keep changing
    this.billboards.forEach((bb) => {
      const y = wrap(bb.base - s, BB_RING);
      if (bb.last !== undefined && y > bb.last + BB_RING / 2) {
        this.posterCount++;
        bb.el.style.setProperty(
          "--tex",
          this.textures[this.posterCount % this.textures.length],
        );
      }
      bb.last = y;
      bb.el.style.transform = `translate3d(0,${r2(y)}px,0)`;
    });

    //the car gently drifts within its lane
    const t = this.time;
    const sway = Math.sin(t * 0.8) * 6;
    const yaw = Math.cos(t * 0.8) * 1.6;
    this.carEl.style.transform = `translate(${r2(sway)}px,0) rotateZ(${r2(yaw)}deg) scale3d(${VEH_SCALE},${VEH_SCALE},${VEH_SCALE})`;
  }
}

customElements.define("fn-supercar", FnSupercar);
