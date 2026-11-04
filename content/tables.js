/*
 * The text panels: one entry per billboard, in the order the car drives to them (they repeat in the same order as the
 * billboard art, so the first is the PLAYER 1 profile screen). Loaded by index.html before lib/lambo.js.
 *
 *   title   the panel's heading, also the name of its stop on the progress strip
 *   scores  rows of [name, score] for the high score list under the title
 *   text    the paragraphs
 *   media   optional: [{ type: "image" | "video" | "audio", file, subtitle }]; images and videos open full screen
 *   text2   optional: more paragraphs, shown after the media
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
      "Kidshibuya.io single page built with the most basic of building blocks, just HTML, CSS and JavaScript. No npm installs, no libraries. It is designed to be fast, responsive and accessible. And lets not forget simple. Not everything needs to be a React app, and not everything needs to be a single page app. No loading bar, no three.js, just perfect 100s in Lighthouse and Page Speed Insights.",
    ],
    media: [
      {
        type: "image",
        subtitle: "Lighthouse",
        file: "./images/cv-100.png",
      },
      {
        type: "image",
        subtitle: "Page Speed Insights",
        file: "./images/pageSpeedPerfect.png",
      },
    ],

    text2: [
      "The road is just a collection of divs, the car a simple image with rotating css wheels...  The billboards that signpost my work are just divs with css. The only thing that is a bit more complex is the progress strip, which is just a collection of divs with background images and a little bit of JavaScript to make it scroll.",
      "The sky is full of twinkling stars and if you are lucky, you might even see a shooting star. The buildings have window lights, but try flicking the sound on, you will get a surprise. And the vibe mode...",
    ],
    links: [
      {
        text: "Resume",
        type: "download",
        file: "./content/NathanBrown_CV_2026.docx",
      },
    ],
  },
  {
    title: "LEET SKILLS",
    scores: [
      ["REACT", "9001"],
      ["TS", "8900"],
      ["CSS", "8100"],
    ],
    text: [
      "I'm a senior front-end developer and team lead. My core stack is TypeScript, React (including React 19 and the React Compiler), Zustand, Redux, Vue, Angular, Astro and Web Components, on top of solid HTML5, CSS3 and Sass.",
      "At Rakuten I led a team of 5 building dozens of mini-apps inside the Link superapp (6M+ daily users), including Rakumail, an email client, and a faster web rebuild of the native in-app chat with custom message types such as video carousels.",
      "I also refactored the Broadcasting dashboard that creates, sends and tracks consumer marketing messages. API calls on load went from 60 to 3, Zustand replaced prop chains of 70+ parameters, and the bundle lost several MB and 50+ npm packages.",
      "Before that, at Asurion, I led a UI team of 9 on a React, Redux and TypeScript CRM used by thousands of call-centre agents, and a Vue push-notification dashboard. Knowledge-base search got 100x faster, and five GreenSock animations replaced MP4 onboarding videos, saving 1.8 MB per download.",
      "I dont have many visual examples of my due to NDAs, but here are a few screenshots of my work.",
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
    ],
    text2: [
      "My full-stack background helps me design better APIs with backend teams: PHP, .NET/C#, Node.js, MongoDB, SQL Server, MySQL and AWS. At GoGo World I built a custom .NET CMS and four multilingual sites, cutting translation time from a week to minutes and page weight by about 97%, which grew organic search traffic by over 500%.",
      "I also work with testing (Jest, Vitest), CI/CD (GitHub Actions, CircleCI, Jenkins), WebRTC video, SSO, Elasticsearch, Algolia and analytics. I write code by hand and with AI coding tools, and review everything that ships.",
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
