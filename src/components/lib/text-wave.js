//custom carousel select element
class TextWave extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({
      mode: "open",
    });
    const style = document.createElement("style");
    style.textContent = `
        *{box-sizing: border-box}
        .wrap{
            width:100%;
            height:100%;
        }
        .inner{
          font-size:.5rem;
          display:grid;
          .element{
            display:flex;
            justify-content:center;
            align-items:center;
            width:1rem;
            height:1rem;
            transition: font-size 3s linear;
            &.bloom{
              font-size: 2rem;
              transition: font-size .3s linear;
            }
          }
        }
     
    `;

    const wrap = document.createElement("div");
    wrap.setAttribute("class", "wrap");
    wrap.setAttribute("part", "wrap");
    const inner = document.createElement("div");
    inner.setAttribute("class", "inner");

    wrap.appendChild(inner);
    shadow.appendChild(style);
    shadow.appendChild(wrap);
  }

  static observedAttributes = ["rows", "cols"];
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === "cols") {
        this.shadowRoot
          .querySelector(".inner")
          .setAttribute(
            "style",
            "grid-template-columns: repeat(" + newValue + ", 1fr);",
          );
      }
      if (name === "rows") {
        //not used for now
        //console.log(name, newValue);
      }
    }
  }

  connectedCallback() {
    const totalCols = Number(this.getAttribute("cols"));
    const inner = this.shadowRoot.querySelector(".inner");
    const temp = document.createElement("div");
    temp.innerText = this.textContent;
    const daText = temp.innerText.trim().replaceAll(" ", "").split("");
    let row = 0;
    let col = 0;

    daText.forEach((element, index) => {
      const aDiv = document.createElement("div");
      aDiv.classList.add("element");
      aDiv.innerText = element;

      if (col === totalCols) {
        col = 1;
      } else {
        col++;
      }

      //get first item in row
      if (index % totalCols === 0) {
        row++;
        aDiv.classList.add("rowStart");
      }
      //get last item in row
      if (index % totalCols === totalCols - 1) {
        aDiv.classList.add("rowEnd");
      }
      aDiv.setAttribute("row", row);
      aDiv.setAttribute("col", col);
      inner.appendChild(aDiv);
    });
    inner.querySelector(":last-child").classList.add("lastElement");

    requestAnimationFrame(() => {
      this.runwave();
    });
  }

  addBloom = (item) => {
    item.classList.add("bloom");
    item.addEventListener("transitionend", () => {
      item.classList.remove("bloom");
    });
  };

  bloom = (waveLength, totalRows, apexRow, apexCol) => {
    apexCol = Number(apexCol);
    for (var i = 0; i <= totalRows; i++) {
      // const maxCurrent = Math.floor(totalRows / 2);
      // const current = i > apexRow ? Math.abs(i - totalRows) : i;

      // const currentAngle = (90 / maxCurrent) * current;
      // //console.log("angle: " + currentAngle);

      const activeRow = i + 1;

      const daCos = Math.cos(
        Math.PI / 2 + (i / (totalRows / 2)) * (Math.PI / 2),
      );
      const curPercent = Math.abs(daCos * 100);
      //console.log(daCos, curPercent);

      //const curPercent = (currentAngle / 90) * 100;

      //this is the colunm
      const curBlockGap = Math.abs(
        Math.ceil((waveLength / 100) * curPercent) - waveLength,
      );

      const activeCol = curBlockGap + apexCol;

      const activeElement = this.shadowRoot.querySelector(
        '[col="' + activeCol + '"][row="' + activeRow + '"]',
      );

      if (activeElement) {
        this.addBloom(activeElement);
      }
    }
  };

  runwave = () => {
    const totalRows = this.shadowRoot.querySelectorAll(".rowEnd").length;
    const firstEnd = this.shadowRoot.querySelector(".rowEnd");
    if (!firstEnd) return;
    const totalCols = Number(firstEnd.getAttribute("col"));
    const waveLength = Math.ceil(totalCols / 3);

    // The apex column is tracked as a virtual position (not tied to an
    // element) so the wave can travel past the left edge until its whole
    // trailing tail has left the box.
    if (this.apexCol === undefined) {
      this.apexCol = totalCols;
    }

    this.bloom(waveLength, totalRows, 0, this.apexCol);
    this.apexCol--;

    //the tail extends waveLength columns to the right of the apex,
    //restart only once the tail has fully left the box
    let delay = 100;
    if (this.apexCol + waveLength < 1) {
      this.apexCol = totalCols;
      //let the last blooms finish shrinking (3s transition) plus a short
      //pause so the next wave starts from a clean slate. Override with the
      //"pause" attribute (ms).
      const pause = Number(this.getAttribute("pause"));
      delay =
        this.hasAttribute("pause") && Number.isFinite(pause) ? pause : 3500;
    }

    requestAnimationFrame(() => {
      setTimeout(() => {
        this.runwave();
      }, delay);
    });
  };
}
customElements.define("fn-textwave", TextWave);
