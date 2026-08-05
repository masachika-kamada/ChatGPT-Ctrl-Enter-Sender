/**
 * Applies _locales messages to extension pages.
 *
 * The UI itself stays in plain English; only the parts that have to be
 * understood to make a decision, such as the site access note, are translated.
 * The markup keeps English text so a missing message falls back instead of
 * rendering blank.
 */
export function localizePage(root = document) {
  for (const element of root.querySelectorAll("[data-i18n]")) {
    const message = chrome.i18n.getMessage(element.dataset.i18n);
    if (message) element.textContent = message;
  }
}
