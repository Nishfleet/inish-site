document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".story").forEach((story) => {
      story.hidden = filter !== "all" && story.dataset.section !== filter;
    });
  });
});
