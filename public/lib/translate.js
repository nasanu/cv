import english from "../../translations/en.json";
import japanese from "../../translations/ja.json";
import french from "../../translations/fr.json";

//ISO 639-1 standard language codes
export const Language = {
  English: "en",
  Japanese: "ja",
  French: "fr",
};
export const supportedLangs = [
  Language.English,
  Language.Japanese,
  Language.French,
];

export const initLanguage = () => {
  const previousLang = localStorage.getItem("lang");

  if (previousLang) {
    setLanguage(previousLang);
  } else {
    let selectedLang = Language.English; // the language default is set here
    //below is an attempt to match the users preferred language first
    navigator.languages.some((lang) => {
      if (lang.toLowerCase().includes(Language.English.toLowerCase())) {
        selectedLang = Language.English;
        return true;
      }
      if (lang.toLowerCase().includes(Language.Japanese.toLowerCase())) {
        selectedLang = Language.Japanese;
        return true;
      }
      if (lang.toLowerCase().includes(Language.French.toLowerCase())) {
        selectedLang = Language.French;
        return true;
      }
    });

    setLanguage(selectedLang);
  }
};

export const getLanguage = () => {
  const currentLang = localStorage.getItem("lang");
  document.documentElement.lang = currentLang;
  return currentLang;
};

export const setLanguage = (lang) => {
  localStorage.setItem("lang", lang);
  document.documentElement.lang = lang;
};

export function useTranslation(lang) {
  return function t(key) {
    const lowerKey = key.toLowerCase();
    switch (lang) {
      case Language.English:
        if (english[lowerKey] !== undefined) {
          return english[lowerKey];
        } else {
          return key;
        }
      case Language.Japanese:
        if (japanese[lowerKey] !== undefined) {
          return japanese[lowerKey];
        } else {
          return key;
        }
      case Language.French:
        if (french[lowerKey] !== undefined) {
          return french[lowerKey];
        } else {
          return key;
        }
    }
  };
}

//first function loaded
initLanguage();
export const t = useTranslation(getLanguage());

//custom translate element
class TranslateElement extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const shadow = this.attachShadow({ mode: "open" });
    shadow.appendChild(document.createTextNode(t(this.innerHTML)));
  }
}
customElements.define("fn-translate", TranslateElement);
