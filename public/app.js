const filterStatus = document.getElementById("filter-status");

// The filter bar ships hidden so it never shows as dead buttons without
// JavaScript; reveal it now that the handlers below will run.
document.querySelector(".filters")?.removeAttribute("hidden");

// Keep the ARIA pressed state mirroring the visible .active class, so the
// accessible state cannot drift from what is shown.
function setPressedState(selected) {
  document.querySelectorAll("[data-filter]").forEach((item) => {
    item.setAttribute("aria-pressed", item === selected ? "true" : "false");
  });
}

function visibleStoryCount() {
  return Array.from(document.querySelectorAll(".story")).filter((story) => !story.hidden).length;
}

function announceFilter(label) {
  if (!filterStatus) return;
  const count = visibleStoryCount();
  const noun = count === 1 ? "story" : "stories";
  filterStatus.textContent =
    label === "All" ? `Showing all ${count} ${noun}` : `Showing ${label}: ${count} ${noun}`;
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".story").forEach((story) => {
      story.hidden = filter !== "all" && story.dataset.section !== filter;
    });
    setPressedState(button);
    announceFilter(button.textContent.trim());
  });
});

// Initialize from the static markup: the server-rendered page marks "All" as
// active and the live region starts with the matching announcement.
const initialFilter = document.querySelector("[data-filter].active") ?? document.querySelector("[data-filter]");
if (initialFilter) setPressedState(initialFilter);
