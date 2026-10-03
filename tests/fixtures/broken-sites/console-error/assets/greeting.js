// A typo: the function is called showGreeting, not showGreting.
function showGreeting() {
  document.querySelector("h1")?.setAttribute("title", "Hello!");
}
showGreting();
