const TARGET_SITES = [
  { name: "AXOL", pattern: /^https:\/\/[^/]*\.?axol\.jp\// },
  { name: "SNAR", pattern: /^https:\/\/[^/]*\.?snar\.jp\// },
  { name: "e2r", pattern: /^https:\/\/www\.e2r\.jp\/eARTH\// },
  { name: "i-webs", pattern: /^https:\/\/[^/]*\.?i-webs\.jp\// },
  { name: "Sony", pattern: /^https:\/\/www\.recruit\.sony\.co\.jp\// },
  { name: "Asahi Kasei", pattern: /^https:\/\/www\.asahi-kasei-info\.com\// }
];

function getSupportedSite(url) {
  return TARGET_SITES.find((site) => site.pattern.test(url || "")) || null;
}

const fillButton = document.getElementById("fill-button");
const optionsButton = document.getElementById("options-button");
const statusEl = document.getElementById("status");
const pageStatusEl = document.getElementById("page-status");
const PROFILE_KEY = "profile";

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = type;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function hasProfile() {
  const { profile } = await chrome.storage.local.get(PROFILE_KEY);
  return Boolean(profile && Object.values(profile).some((value) => String(value || "").trim()));
}

async function injectAndFill(tabId, profile) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (payload) => window.myPageAutofill?.fill(payload),
    args: [profile]
  });

  return result?.result;
}

async function initialize() {
  try {
    const tab = await getActiveTab();
    const supportedSite = getSupportedSite(tab?.url);
    const ready = await hasProfile();

    pageStatusEl.textContent = supportedSite
      ? `${supportedSite.name}ページで実行できます。`
      : "AXOL/SNAR/e2r/i-webs/Sony/旭化成ページを開いてから実行してください。";
    fillButton.disabled = !supportedSite || !ready;

    if (!ready) {
      setStatus("先にプロフィール設定を保存してください。", "error");
    } else if (!supportedSite) {
      setStatus("対象: https://*.axol.jp/*, https://*.snar.jp/*, https://www.e2r.jp/eARTH/*, https://*.i-webs.jp/*, https://www.recruit.sony.co.jp/*, https://www.asahi-kasei-info.com/*", "error");
    } else {
      setStatus("入力内容を確認してから実行してください。プロフィールはこのChrome拡張内に保存されています。");
    }
  } catch (error) {
    fillButton.disabled = true;
    setStatus("初期化に失敗しました。ページを再読み込みしてからもう一度試してください。", "error");
  }
}

fillButton.addEventListener("click", async () => {
  fillButton.disabled = true;
  setStatus("入力中...");

  try {
    const tab = await getActiveTab();
    if (!getSupportedSite(tab?.url)) {
      setStatus("対象ページを開いてから実行してください。", "error");
      return;
    }

    const { profile } = await chrome.storage.local.get(PROFILE_KEY);
    const result = await injectAndFill(tab.id, profile);

    if (!result?.ok) {
      setStatus(result?.message || "入力に失敗しました。", "error");
      return;
    }

    setStatus(`${result.filledCount}件入力しました。送信前に内容を確認してください。`, "success");
  } catch (error) {
    setStatus("入力に失敗しました。ページを再読み込みしてからもう一度試してください。", "error");
  } finally {
    fillButton.disabled = false;
  }
});

optionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

initialize();
