//custom carousel select element
class Carousel extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({
      mode: "open",
    });
    const style = document.createElement("style");
    style.textContent = `
        *{box-sizing: border-box}
        .carousel-wrap{
            width:100%;
            height:100%;
        }
        .inner > *{
            min-width:100%;
              scroll-snap-align: start;

        }
            .inner{
            display:flex;
            width:100%;
            height:100%;
            overflow-x:scroll;
              scroll-snap-type: x mandatory;

            }
    `;

    const wrap = document.createElement("div");
    wrap.setAttribute("class", "carousel-wrap");
    wrap.setAttribute("part", "carousel-wrap");
    const inner = document.createElement("div");
    inner.setAttribute("class", "inner");

    wrap.appendChild(inner);
    shadow.appendChild(style);
    shadow.appendChild(wrap);
  }

  static observedAttributes = ["template", "min", "max"];

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "template" && oldValue !== newValue) {
      const template = document.getElementById(newValue);
      this.shadowRoot
        .querySelector(".carousel-wrap .inner")
        .appendChild(template.content);
    }
  }

  connectedCallback() {
    const inner = this.shadowRoot.querySelector(".inner");
    const width = this.shadowRoot
      .querySelector(".carousel-wrap")
      .getBoundingClientRect().width;

    inner.addEventListener("scroll", () => {
      //usigng req animation frame as a debounce
      requestAnimationFrame(() => {
        console.log(
          Math.abs(Math.ceil((inner.scrollLeft - width / 2) / width)),
        );
      });
    });
  }
}
customElements.define("rex-carousel", Carousel);
