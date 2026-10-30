//custom input element
class FormInput extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });

    const wrap = document.createElement("div");
    wrap.setAttribute("class", "form-input");
    wrap.setAttribute("part", "form-input");
    wrap.setAttribute("tabindex", "1");
    const inputGroup = document.createElement("div");
    inputGroup.setAttribute("class", "input-group");

    //The input element itself
    const input = document.createElement("input");
    input.setAttribute("autocomplete", "off"); //todo
    input.value = this.getAttribute("value");
    input.placeholder = this.getAttribute("placeholder")
      ? this.getAttribute("placeHolder")
      : "";

    wrap.appendChild(input);

    //if input has a title prop
    const title = this.getAttribute("title");
    const lblTitle = document.createElement("label");
    lblTitle.classList.add("title");
    if (title) {
      const required = this.getAttribute("required") ? true : false;
      if (required) {
        lblTitle.textContent = title + " (required)";
      } else {
        lblTitle.textContent = title;
      }
    }
    wrap.prepend(lblTitle);
    //create footer label for footer/error text
    const lblFooter = document.createElement("label");
    const footer = this.getAttribute("footer");
    lblFooter.classList.add("footer");
    if (footer) {
      lblFooter.textContent = footer;
    }

    wrap.appendChild(lblFooter);

    const style = document.createElement("style");
    style.textContent = `
    *{box-sizing:border-box}
    label.title {
      padding-left: 1rem;
      font-size: 0.875rem;
      min-height:1.3125rem;
      margin-bottom:.25rem;
    }
    label.footer {
      padding-left: 1rem;
      font-size: 0.75rem;
      min-height:1.3125rem;
      margin-top:.25rem;
    }
      input {
          font-family: var(--rex-font);
          font-size: 1rem;
          line-height: 100%;
          padding: 0rem 1rem;
          border-radius: 0.5rem;
          height: 2.875rem;
          border: 1px solid var(--inputBorder);
          color: var(--inputText);
          outline: none;
          &:hover {
            border: 1px solid var(--input-border-hover);
          }
        }
          .form-input.error label.footer, .form-input.error:hover label.footer{
          
            color:var(--error);
            background-image: url("./danger.svg");
            background-size:.75rem;
            background-repeat:no-repeat;
            background-position: 1rem .22rem;
            padding-left:2rem;
          
       
        }
        .form-input.error input, .form-input.error:hover input{
      
            border: 2px solid var(--error);
            //alt rex style
            // background-image: url("./danger.svg");
            // background-size:1.125rem;
            // background-repeat:no-repeat;
            // background-position: calc(100% - 1rem) center;
          
        }

      .form-input {
        margin-bottom: 1rem;
        position: relative;
        display: flex;
        flex-direction: column;
        
      }
    `;
    shadow.appendChild(style);
    shadow.appendChild(wrap);
  }

  dispatch(e) {
    let isValid = this.getAttribute("error") ? false : true;
    const required = this.getAttribute("required") ? true : false;
    if (isValid && required && e.type === "focusout") {
      isValid = e.target.value.trim() ? true : false;
    }

    const formInput = this.shadowRoot.querySelector(".form-input");
    if (!isValid) {
      formInput.classList.add("error");
      const footerText = this.getAttribute("error")
        ? this.getAttribute("error")
        : this.getAttribute("required");
      this.shadowRoot.querySelector(".footer").textContent = footerText;
    } else {
      formInput.classList.remove("error");
      this.shadowRoot.querySelector(".footer").textContent =
        this.getAttribute("footer");
    }
    this.dispatchEvent(
      new CustomEvent(this.getAttribute("name") + "Event", {
        bubbles: true,
        detail: { value: e.target.value, type: e.type },
      }),
    );
  }

  connectedCallback() {
    const input = this.shadowRoot.querySelector("input");
    input.addEventListener("input", this.dispatch.bind(this));
    input.addEventListener("focusin", this.dispatch.bind(this));
    input.addEventListener("focusout", this.dispatch.bind(this));
    const wrap = this.shadowRoot.querySelector(".form-input");
    wrap.addEventListener("focusin", () => {
      input.focus();
    });
  }

  disconnectedCallback() {
    //from my understanding no remove event needed
    //for events attached to custom elements,
    //they are destroyed when the element is
  }

  static observedAttributes = [
    "title",
    "footer",
    "required",
    "value",
    "name",
    "error",
    "type",
    "placeholder",
  ];
  attributeChangedCallback(name, oldValue, newValue) {
    //basically this entire function is to setup values that are set dymanically via JS in code
    // these are not present at the time the constructor is run

    if (oldValue !== newValue) {
      if (name === "title") {
        let title = this.shadowRoot.querySelector(".title");
        const required = this.getAttribute("required") ? true : false;
        if (required) {
          title.textContent = newValue + " (required)";
        } else {
          title.textContent = newValue;
        }
      }
      if (name === "footer") {
        const isValid = this.getAttribute("error") ? false : true;
        if (isValid) {
          const footer = this.shadowRoot.querySelector(".footer");
          footer.textContent = newValue;
        }
      }
      if (name === "required") {
        const title = this.shadowRoot.querySelector(".title");
        if (title) {
          if (this.getAttribute("title"))
            title.textContent = this.getAttribute("title") + " (required)";
        }
      }
      if (name === "placeholder") {
        const input = this.shadowRoot.querySelector("input");
        if (input) {
          input.setAttribute("placeholder", newValue);
        }
      }

      if (name === "name") {
        const input = this.shadowRoot.querySelector("input");
        input.name = newValue;
      }
      if (name === "value") {
        const input = this.shadowRoot.querySelector("input");
        input.value = newValue;
      }
      if (name === "type") {
        const input = this.shadowRoot.querySelector("input");
        input.type = newValue;
      }
      if (name === "error") {
        const wrap = this.shadowRoot.querySelector(".form-input");
        let lblError = wrap.querySelector("label.error");
        if (!lblError) {
          wrap.classList.remove("error");
          this.shadowRoot.querySelector(".footer").textContent =
            this.getAttribute("footer");
        } else {
          lblError.classList.add("error");
          lblError.textContent = newValue;
          wrap.appendChild(lblError);
        }
        if (newValue && newValue !== "") {
          wrap.classList.add("error");
          this.shadowRoot.querySelector(".footer").textContent = newValue;
        }
      }
    }
  }
}
customElements.define("rex-input", FormInput);
