export { };

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // We have added "tabs" permission to manifest.json, so we can access tab.url
    const url = tab?.url;
    if (!url) return;

    // We only want to inject the script into the beta.scrintal.com/app page after it has loaded
    if (changeInfo.status === "complete" && url.startsWith("https://beta.scrintal.com/app")) {
        setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { type: "init" });
        }, 1000);
    }
});
