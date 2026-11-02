/*
 * The text panels: one entry per billboard, in the order the car drives to them (they repeat in the same order as the
 * billboard art, so the first is the PLAYER 1 profile screen). Loaded by index.html before lib/lambo.js.
 *
 *   title   the panel's heading, also the name of its stop on the progress strip
 *   scores  rows of [name, score] for the high score list under the title
 *   text    the paragraphs
 *   media   optional: [{ type: "image" | "video" | "audio", file, subtitle }]; images and videos open full screen
 *   links   optional: [{ text, type: "download" | "youtube", file }], as buttons under the text
 *
 * File paths are relative to the page (index.html), not to this file.
 */
window.fnLamboTables = [
  {
    title: "ME",
    scores: [
      ["F_D", "9478"],
      ["007", "1337"],
      ["B_N", "70"],
    ],
    text: [
      "I am Nathan Brown, a software engineer with a passion for UX. I have been making apps and sites since I was 15 years old, working professionally for the past 30 years.",
      "I have worked on a wide variety of projects, in small startups to large enterprises. I have experience in a wide range of technologies, including web development, mobile development, and now AI driven development.",
      "This site is a showcase of my work, starting by detailing the site you are on right now.",
      "Kidshibuya.io single page built with the most basic of building blocks, just HTML, CSS and JavaScript. No npm installs, no libraries. It is designed to be fast, responsive and accessible. And lets not forget simple. Not everything needs to be a React app, and not everything needs to be a single page app. No loading bar, no three.js, just perfect 100s in Lighthouse.",
       "The road is just a collection of divs, the car a simple image with rotating css wheels...  The billboards that signpost my work are just divs with css. The only thing that is a bit more complex is the progress strip, which is just a collection of divs with background images and a little bit of JavaScript to make it scroll.",
      "The sky is full of twinkling stars and if you are lucky, you might even see a shooting star. The buildings have window lights, but try flicking the sound on, you will get a surprise. And the vibe mode...",
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
        file: "./images/himawariCut.jpg",
      },
      {
        type: "image",
        subtitle: "My CMS - FE Editing",
        file: "./images/frontend1.jpg",
      },
      {
        type: "image",
        subtitle: "My CMS - BE Editing",
        file: "./images/backend1.jpg",
      },
      {
        type: "image",
        subtitle: "My CMS - Performance",
        file: "./images/speed.jpg",
      },
      {
        type: "image",
        subtitle: "AstroJS/React Miniapp Performance",
        file: "./images/100.png",
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
