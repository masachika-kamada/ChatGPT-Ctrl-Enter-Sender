// document.addEventListener("click", (event) => {
//   console.log("target element:", event.target);
// });

document.addEventListener("keydown", (event) => {
  if (event.target.tagName === "TEXTAREA" && event.code == "Enter" && !event.ctrlKey) {
      event.stopPropagation();
  }
}, { capture: true });
