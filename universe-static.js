document.querySelectorAll(".node, .capsule").forEach((el) => {
  el.addEventListener("mouseenter", () => {
    el.style.transform = "translate(-50%, -50%) scale(1.05)";
  });

  el.addEventListener("mouseleave", () => {
    el.style.transform = "translate(-50%, -50%) scale(1)";
  });
});
