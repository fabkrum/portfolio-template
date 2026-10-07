// A banner that appears late, a second after the page was first shown, above
// everything, and pushes the page down. A second, not less: Chrome takes a
// shift in the first moments of loading for one caused by input, and leaves
// it out of CLS.
new PerformanceObserver((list, observer) => {
  if (!list.getEntries().some((entry) => entry.name === "first-contentful-paint")) return;
  observer.disconnect();
  setTimeout(() => {
    const banner = document.createElement("p");
    banner.textContent = "A late banner";
    banner.style.blockSize = "400px";
    banner.style.margin = "0";
    document.body.prepend(banner);
  }, 1000);
}).observe({ type: "paint", buffered: true });
