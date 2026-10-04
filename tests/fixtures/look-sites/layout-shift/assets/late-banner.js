// A banner that appears late, once the content is on the page, above
// everything, and pushes the page down.
const contentShown = () => document.querySelector(".project");
const timer = setInterval(() => {
  if (!contentShown()) return;
  clearInterval(timer);
  setTimeout(() => {
    const banner = document.createElement("p");
    banner.textContent = "A late banner";
    banner.style.blockSize = "400px";
    banner.style.margin = "0";
    document.body.prepend(banner);
  }, 300);
}, 50);
