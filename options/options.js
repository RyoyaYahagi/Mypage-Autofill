const form = document.getElementById("profile-form");
const statusEl = document.getElementById("status");
const clearButton = document.getElementById("clear-button");
const PROFILE_KEY = "profile";

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
  const sessionData = await chrome.storage.session.get(PROFILE_KEY);
  let profile = sessionData[PROFILE_KEY];

  if (!profile) {
    const localData = await chrome.storage.local.get(PROFILE_KEY);
    profile = localData[PROFILE_KEY];
    if (profile) {
      await chrome.storage.session.set({ [PROFILE_KEY]: profile });
      await chrome.storage.local.remove(PROFILE_KEY);
    }
  }

  writeForm(profile);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await chrome.storage.session.set({ [PROFILE_KEY]: readForm() });
    await chrome.storage.local.remove(PROFILE_KEY);
    setStatus("保存しました。ブラウザ終了時に削除されます。");
  } catch (error) {
    setStatus("保存に失敗しました。もう一度試してください。", true);
  }
});

clearButton.addEventListener("click", async () => {
  try {
    await chrome.storage.session.remove(PROFILE_KEY);
    await chrome.storage.local.remove(PROFILE_KEY);
    form.reset();
    setStatus("削除しました。");
  } catch (error) {
    setStatus("削除に失敗しました。もう一度試してください。", true);
  }
});

loadProfile().catch((error) => {
  setStatus("読み込みに失敗しました。もう一度開き直してください。", true);
});
