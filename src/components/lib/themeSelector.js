//custom theme select element
class ThemeSelect extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
        *{box-sizing: border-box}
        .theme-selector {
            position: relative;
            width: 3rem;
            height: 1rem;
            border-radius: var(--borderRadius);
            background-color: var(--accent);
            display: flex;
            align-items: center;
        }
        .icon {
            position: absolute;
            height: 2rem;
            width: 2rem;
            border-radius: 50%;
            padding: 0.4rem;
            cursor: pointer;
            background-color: #3d3d3d;
            transition: left 0.3s ease;
            box-shadow: 2px 1px 5px 0px rgba(0, 0, 0, 0.7);
        }
        .icon img {
            display: none;
        }
        .icon.dark {
            left: calc(100% - 1rem);
        }
        .icon.dark img.dark {
            display: block;
        }
        .icon.light {
            left: -1rem;
        }
        .icon.light .light {
            display: block;
        }
        .icon.light .dark {
            display: none;
        }
        img {
            height: 100%;
        }
    `;

    const wrap = document.createElement("div");
    wrap.setAttribute("class", "theme-selector");
    const icon = document.createElement("div");
    icon.setAttribute("class", "icon");
    const sun = document.createElement("img");
    sun.setAttribute("src", "sun.svg");
    sun.setAttribute("class", "light");
    const moon = document.createElement("img");
    moon.setAttribute("class", "dark");
    moon.setAttribute("src", "moon.svg");

    icon.appendChild(sun);
    icon.appendChild(moon);
    wrap.appendChild(icon);
    shadow.appendChild(style);
    shadow.appendChild(wrap);

    wrap.addEventListener("click", () => {
      removeSelected();
      if (getStoredTheme() === "light") {
        changeTheme("dark");
      } else {
        changeTheme("light");
      }
    });

    const removeSelected = () => {
      icon.classList.remove("light");
      icon.classList.remove("dark");
    };

    const changeTheme = (theme) => {
      removeSelected();
      setCurrentTheme(theme);
      storeThemeChoice(theme);
    };

    const storeThemeChoice = (theme) => {
      localStorage.setItem("theme", theme);
    };
    const getStoredTheme = () => {
      return localStorage.getItem("theme");
    };

    const setCurrentTheme = (theme) => {
      removeSelected();
      document.documentElement.style.setProperty("color-scheme", theme);
      if (theme === "light") {
        icon.classList.add("light");
      } else {
        icon.classList.add("dark");
      }
    };

    const theme = getStoredTheme();
    if (theme) {
      setCurrentTheme(theme);
    } else {
      let theme = "light";
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        theme = "dark";
      }
      changeTheme(theme);
    }
  }
}
customElements.define("rex-theme", ThemeSelect);
