// Gentle falling petals used across the landing and girl pages.
(function () {
  const layer = document.querySelector(".petals");
  if (!layer) return;

  function createPetal() {
    const petal = document.createElement("span");
    petal.className = "petal";
    petal.innerHTML = "&hearts;";
    petal.style.left = `${Math.random() * 100}vw`;
    petal.style.animationDuration = `${7 + Math.random() * 5}s`;
    petal.style.opacity = `${0.22 + Math.random() * 0.34}`;
    petal.style.fontSize = `${14 + Math.random() * 16}px`;
    layer.appendChild(petal);
    setTimeout(() => petal.remove(), 12000);
  }

  setInterval(createPetal, 700);
})();
