//custom search select element

import "../lib/input.js";

class SearchSelect extends HTMLElement {
  constructor() {
    super();
    this.height = 0;
    this.openBelow = true;
    this.rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    this.itemHeight = this.rem * 3.5;
    this.filtered = [];
    this.items = JSON.parse(this.getAttribute("items"));
    const shadow = this.attachShadow({ mode: "open" });
    this.wrap = document.createElement("div");
    this.wrap.setAttribute("class", "search-select");
    this.input = document.createElement("rex-input");
    this.input.setAttribute("name", "searchSelect");
    this.input.setAttribute("id", "searchSelect");
    this.wrap.appendChild(this.input);
    this.listWrap = document.createElement("div");
    this.listWrap.classList.add("list-wrap");
    this.listWrap.setAttribute("tabindex", 2);
    this.inner = document.createElement("div");
    this.inner.classList.add("inner");
    this.listWrap.appendChild(this.inner);
    this.wrap.appendChild(this.listWrap);
    const style = document.createElement("style");
    style.textContent = `
      *{box-sizing:border-box}
        .search-select rex-input {
      position: relative;
      z-index: 99;
    }
      rex-input::part(form-input){
      margin:0}
    .search-select {
      position: relative;
      z-index: 99;
      top: 0;
      &.above .list-wrap {
        bottom: 0;
      }

      .list-wrap {
        outline: none;
        transition: opacity 0.2s linear;
        /* maybe just restore these for desktop or make then tons better */
        /* max-height 0.3s ease-out,
        height 0.3s ease-out; */
        /* top 0.3s ease-out; */
        pointer-events: none;
        &.open {
          opacity: 1;
          z-index: 9;
          pointer-events: all;
        }
        padding: 0.3rem 0.5rem;
        opacity: 0;
        position: absolute;
        left: 0;
        right: 0;
        display: flex;
        flex-direction: column;

        border-radius: var(--borderRadius);
        background-color: var(--dropDownBG);
        overflow-y: auto;

        .select-item {
          display: flex;
          align-items: center;
          cursor: pointer;
          padding: 0.3rem 1rem;
          border-radius: var(--borderRadius);

          &.selected {
            background-color: var(--menuHover);
            color: var(--error);
          }
        }
      }
    }
      `;
    shadow.appendChild(style);
    shadow.appendChild(this.wrap);
  }

  connectedCallback() {
    //events

    this.shadowRoot.addEventListener("click", () => {
      if (!this.wrap.querySelector("rex-input:focus")) {
        this.close.bind(this);
      }
    });
    this.shadowRoot.addEventListener(
      "searchSelectEvent",
      this.listener.bind(this),
    );
    this.wrap.addEventListener("focusin", this.listener2.bind(this));
    this.wrap.addEventListener("focusout", this.listener2.bind(this));

    this.shadowRoot.addEventListener("keydown", (event) => {
      if (this.listWrap.classList.contains("open")) {
        //enter/return/select
        if (event.key === "Enter") {
          const selected = this.listWrap.querySelector(".selected");
          if (selected) selected.click();
        }

        //arrow down / up
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          this.moveSelection(event.key === "ArrowDown" ? 1 : -1);
        }
      }
    });

    //a real mouse movement hands control back to hover selection
    this.listWrap.addEventListener("mousemove", (e) => {
      this.keyboardNav = false;
      const item = e.target.closest ? e.target.closest(".select-item") : null;
      if (item && !item.classList.contains("selected")) {
        this.addSelect(item);
      }
    });

    window.visualViewport.addEventListener("resize", this.setPosition);
    window.visualViewport.addEventListener("scroll", this.setPosition);

    this.setPosition();
    this.listWrap.onscroll = this.scrollItems;
  }

  disconnectedCallback() {
    //from my understanding no remove event needed
    //for events attached to custom elements,
    //they are destroyed when the element is
  }

  static observedAttributes = [
    "items",
    "title",
    "footer",
    "required",
    "value",
    "name",
    "error",
    "placeholder",
  ];
  attributeChangedCallback(name, oldValue, newValue) {
    //basically this entire function is to setup values that are set dymanically via JS in code
    // and are not present at the time the constructor is run

    if (oldValue !== newValue) {
      if (name === "items") {
        this.filtered = JSON.parse(newValue);
      }
    }
  }

  //close the select popup
  close = () => {
    this.listWrap.classList.remove("open");
    this.input.blur();
  };

  //fired on searchSelectEvent
  listener = (e) => {
    this.listWrap.classList.add("open");
    const { value, type } = e.detail;
    if (type === "input") {
      this.filtered = this.items.filter((item) => {
        return item.name.indexOf(value) >= 0;
      });
      //indexes refer to the previous result set, so the old selection and
      //scroll position are meaningless now
      this.wrap.removeAttribute("data-selected");
      this.centerOn = undefined;
      this.listWrap.scrollTop = 0;
      this.scrollItems();
    }
    if (type !== "focusout") {
      this.setPosition();
    } else {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  listener2 = (e) => {
    const { type } = e;
    if (e.type === "click" && e.target.classList.contains("select-item")) {
      const code = e.target.getAttribute("code");

      if (!code) {
        this.input.setAttribute("value", e.target.textContent);
        const value = e.target.getAttribute("data-value");
        this.close();
        this.resetSearch(value);
      }
    } else if (type === "focusin" || type === "click") {
      this.listWrap.classList.add("open");
      this.input.focus();
    } else if (type === "focusout") {
      if (!this.shadowRoot.querySelector(".search-select:focus-within")) {
        this.close();
      }
    }
  };

  //clear the active search so the full list is shown next time the box is
  //opened (the input keeps the chosen value, only the results are reset)
  resetSearch = (value) => {
    this.filtered = this.items.slice();
    this.listWrap.scrollTop = 0;

    //keep the chosen item selected, and centre the list on it when reopened
    const index = this.items.findIndex((item) => String(item.value) === value);
    if (index >= 0) {
      this.wrap.setAttribute("data-selected", index.toString());
      this.centerOn = index;
    } else {
      this.wrap.removeAttribute("data-selected");
      this.centerOn = undefined;
    }
    this.setPosition();
  };

  //scroll so the item at index sits in the middle of the visible list
  centerItem = (index) => {
    //render once first so the scrollable height of the full list exists
    this.scrollItems();
    const pad = parseFloat(getComputedStyle(this.listWrap).paddingTop) || 0;
    const itemCenter = pad + index * this.itemHeight + this.itemHeight / 2;
    this.listWrap.scrollTop = itemCenter - this.listWrap.clientHeight / 2;
  };

  addSelect = (event) => {
    let e;
    if (event.target) {
      //ignore the synthetic mouseenter the browser fires when the list is
      //rebuilt under a resting cursor during keyboard navigation
      if (this.keyboardNav) return;
      e = event.target;
    } else {
      e = event;
    }
    this.removeAllSelect(this.listWrap.querySelectorAll(".select-item"));
    e.classList.add("selected");
    this.wrap.setAttribute("data-selected", e.dataset.index);
  };
  removeSelect = (e) => {
    if (this.keyboardNav) return;
    e.target.classList.remove("selected");
  };

  removeAllSelect = (selectItems) => {
    selectItems.forEach((item) => {
      item.classList.remove("selected");
    });
  };

  buildItems = (start, end) => {
    const selected = this.wrap.dataset.selected;
    this.inner.innerHTML = "";
    if (!this.filtered.length) {
      this.filtered.push({ name: "yeah nah bro", value: "-1", code: "404" });
    }
    this.filtered.forEach((item, index) => {
      if (index >= start && index <= end) {
        const newItem = document.createElement("div");
        newItem.style.height = this.itemHeight + "px";
        newItem.setAttribute("data-value", item.value);
        newItem.setAttribute("data-index", index.toString());
        newItem.textContent = item.name;
        newItem.className = "select-item";
        newItem.onmouseenter = this.addSelect;
        newItem.onmouseleave = this.removeSelect;
        if (item.code) {
          newItem.setAttribute("code", item.code);
          newItem.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
          };
        } else {
          newItem.onclick = this.listener2;
        }
        if (Number(selected) === index) {
          newItem.classList.add("selected");
        }

        this.inner.appendChild(newItem);
      }
    });

    const paddingTop =
      this.filtered.length > this.displayed() - 1 ? start * this.itemHeight : 0;
    this.inner.style.paddingTop = paddingTop + "px";
    //end is inclusive, so only the items after it still need space
    const paddingBot = Math.max(0, this.filtered.length - 1 - end);
    this.inner.style.paddingBottom = paddingBot * this.itemHeight + "px";
  };

  //move the selection by delta items. The selected index (data-selected) is
  //the single source of truth, not whatever happens to be rendered, because
  //only a window of the list exists in the DOM at any time.
  moveSelection = (delta) => {
    const count = this.filtered.length;
    if (!count) return;

    this.keyboardNav = true;
    const raw = this.wrap.dataset.selected;
    const current = raw === undefined || raw === "" ? NaN : Number(raw);
    let next;
    if (!Number.isInteger(current) || current < 0 || current >= count) {
      next = 0;
    } else {
      next = Math.min(count - 1, Math.max(0, current + delta));
    }

    this.wrap.setAttribute("data-selected", next.toString());
    this.ensureVisible(next);
    //rebuild synchronously; waiting for the async scroll event lets fast key
    //repeats run against a stale window
    this.scrollItems();
  };

  //scroll just enough to bring the item at index fully into view
  ensureVisible = (index) => {
    const pad = parseFloat(getComputedStyle(this.listWrap).paddingTop) || 0;
    const itemTop = pad + index * this.itemHeight;
    const itemBottom = itemTop + this.itemHeight;
    const view = this.listWrap.clientHeight;
    const scrollTop = this.listWrap.scrollTop;

    if (itemTop - pad < scrollTop) {
      this.listWrap.scrollTop = itemTop - pad;
    } else if (itemBottom + pad > scrollTop + view) {
      this.listWrap.scrollTop = itemBottom + pad - view;
    }
  };

  setOuterHeight = () => {
    if (this.listWrap.classList.contains("open")) {
      this.listWrap.style.height = this.height + "px";
      if (this.centerOn !== undefined) {
        this.centerItem(this.centerOn);
        this.centerOn = undefined;
      }
      this.scrollItems();
    } else {
      this.listWrap.style.height = "0px";
    }
  };

  heightfn = (space) => {
    //height from pos
    return (
      Math.max(
        Math.min(
          Math.floor(space / this.itemHeight) * this.itemHeight,
          this.filtered.length * this.itemHeight,
        ),
        this.itemHeight,
      ) +
      this.rem * 0.6
    );
  };

  spaceTop = () => {
    return (
      this.input.getBoundingClientRect().top -
      window.visualViewport.offsetTop -
      this.rem
    );
  };

  spaceBot = () => {
    return (
      window.visualViewport.height -
      this.input.getBoundingClientRect().bottom -
      this.rem
    );
  };

  setPosition = () => {
    this.listWrap.style.top = "0px";
    if (this.spaceTop() - 3 * this.rem > this.spaceBot()) {
      //biased to pick space below if almost 50 -50
      this.openBelow = false;
      this.height = this.heightfn(this.spaceTop());

      if (this.listWrap.classList.contains("open")) {
        this.listWrap.style.top = -this.height + "px";
      }
    } else {
      this.openBelow = true;
      this.listWrap.style.top = "6rem";
      this.height = this.heightfn(this.spaceBot());
    }
    this.wrap.className = "search-select";
    this.wrap.classList.add(this.openBelow ? "below" : "above");

    this.setOuterHeight();
  };

  displayed = () => {
    return Math.floor(parseInt(this.listWrap.style.height) / this.itemHeight);
  };

  scrollItems = () => {
    const pad = parseFloat(getComputedStyle(this.listWrap).paddingTop) || 0;
    //items start after the list's top padding, so account for it or the first
    //partially visible item gets skipped
    const start = Math.max(
      0,
      Math.floor((this.listWrap.scrollTop - pad) / this.itemHeight),
    );
    //one extra item covers the partially visible one at the bottom
    this.buildItems(
      start,
      Math.min(start + this.displayed() + 1, this.filtered.length),
    );
  };
}

customElements.define("rex-searchselect", SearchSelect);
