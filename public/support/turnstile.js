(async function setupSupportTurnstile() {
  const params = new URLSearchParams(window.location.search);
  const jobId = (params.get("jobId") || "").replace(/[^a-zA-Z0-9_:-]/g, "").slice(0, 80);
  const category = (params.get("category") || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  const message = (params.get("message") || "").slice(0, 1000);
  const jobIdInput = document.querySelector('input[name="jobId"]');
  const categorySelect = document.querySelector('select[name="category"]');
  const messageInput = document.querySelector('textarea[name="message"]');
  if (jobId && jobIdInput) jobIdInput.value = jobId;
  if (category && categorySelect && [...categorySelect.options].some((option) => option.value === category)) {
    categorySelect.value = category;
  }
  if (message && messageInput && !messageInput.value) messageInput.value = message;

  const container = document.querySelector("[data-turnstile-support]");
  if (!container) return;

  const config = await fetch("/api/config")
    .then((response) => (response.ok ? response.json() : {}))
    .catch(() => ({}));
  if (!config.turnstileSiteKey) {
    container.remove();
    return;
  }

  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.defer = true;
  script.onload = () => {
    window.turnstile?.render(container, {
      sitekey: config.turnstileSiteKey,
      theme: "auto",
      size: "flexible"
    });
  };
  document.head.appendChild(script);
})();
