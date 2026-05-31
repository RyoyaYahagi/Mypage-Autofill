const form = document.getElementById("profile-form");
const statusEl = document.getElementById("status");
const clearButton = document.getElementById("clear-button");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? "error" : "";
}

function readForm() {
  return Object.fromEntries(new FormData(form).entries());
}

function writeForm(profile = {}) {
  for (const element of form.elements) {
    if (!element.name) continue;
    element.value = profile[element.name] || "";
  }
}

async function loadProfile() {
  const { profile } = await chrome.storage.local.get("profile");
  writeForm(profile);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await chrome.storage.local.set({ profile: readForm() });
    setStatus("保存しました。");
  } catch (error) {
    setStatus(`保存に失敗しました: ${error.message}`, true);
  }
});

clearButton.addEventListener("click", async () => {
  try {
    await chrome.storage.local.remove("profile");
    form.reset();
    setStatus("削除しました。");
  } catch (error) {
    setStatus(`削除に失敗しました: ${error.message}`, true);
  }
});

loadProfile().catch((error) => {
  setStatus(`読み込みに失敗しました: ${error.message}`, true);
});
