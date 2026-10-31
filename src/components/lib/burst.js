class Burst extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({
      mode: "open",
    });
    const style = document.createElement("style");
    style.textContent = `
          *{box-sizing: border-box}

          .particles {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 100%;
                height: 100%;
                z-index: 999;
            }
            .confetti-container {
                position: relative;
                width: 100%;
                height: 100%;
                .particle {
                position: absolute;
                width: 20px;
                height: 20px;
                pointer-events: none;
                transform: rotate(0);
                opacity: 1;
                background-repeat: no-repeat;
                background-size: contain;
                background-color: aqua;
                border-radius: 50%;
                &.finished {
                    transition: all ${this.getAttribute("duration")}s ease-out;
                    opacity: 0;
                }
            }
        }
      `;

    const wrap = document.createElement("div");
    wrap.setAttribute("class", "particles");
    wrap.setAttribute("part", "particles");
    const inner = document.createElement("div");
    inner.setAttribute("class", "confetti-container");

    wrap.appendChild(inner);
    shadow.appendChild(style);
    shadow.appendChild(wrap);
  }

  connectedCallback() {
    const container = this.shadowRoot.querySelector(".confetti-container");
    if (container) {
      const duration = this.getAttribute("duration");
      function random(min, max) {
        return Math.random() * (max - min) + min;
      }

      class Particle {
        constructor(x, y) {
          this.x = x;
          this.y = y;
          this.initialX = x;
          this.initialY = y;
          this.angle = random(0, Math.PI * 2);
          this.speed = random(0.95, 1.05);
          this.finished = false;
        }
        render() {
          const element = document.createElement("div");
          element.className = "particle";
          element.id = this.id;
          element.style.left = this.x + "px";
          element.style.top = this.y + "px";
          container.appendChild(element);
          this.calcFinalPosition();
        }
        calcFinalPosition() {
          while (
            Math.sqrt(
              Math.abs(
                (this.initialX - this.x) * (this.initialX - this.x) +
                  (this.initialY - this.y) * (this.initialY - this.y),
              ),
            ) < 100
          ) {
            this.x += Math.cos(this.angle);
            this.y += Math.sin(this.angle);
          }
          requestAnimationFrame(() => {
            const thisParticle = container.querySelector("#" + this.id);
            if (thisParticle) {
              thisParticle.style.left = this.x * this.speed + "px";
              thisParticle.style.top = this.y * this.speed + "px";
              thisParticle.classList.add("finished");
              thisParticle.style.transform = "rotate(360deg)";
            }
          });
          setTimeout(() => {
            if (container.querySelector("#" + this.id))
              container.querySelector("#" + this.id).remove();
          }, duration * 1000);
        }
      }

      const particles = [];

      const run = (event) => {
        let particle;
        const fixedRnd = random(0.55, 1.45);
        for (var i = 0; i < this.getAttribute("particleCount"); i++) {
          if (event.pageX !== 0 && event.pageY !== 0) {
            particle = new Particle(
              event.x - container.getBoundingClientRect().x,
              event.y - container.getBoundingClientRect().y,
            );
          } else {
            particle = new Particle(
              (container.getBoundingClientRect().width * fixedRnd) / 2,
              (container.getBoundingClientRect().height * fixedRnd) / 2,
            );
          }

          particle.id = "particle" + particles.length;
          particles.push(particle);
          particle.render();
        }
      };

      this.addEventListener("click", run);
    }
  }
}
customElements.define("fn-burst", Burst);
