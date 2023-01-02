import { Configuration, OpenAIApi } from "openai";

let alreadyInitialized = false;
let openai: OpenAIApi | null;

// Get the gpt-3 config from the local storage
chrome.storage.local.get(null, (data) => {
    const gptConfig = data.gptConfig;
    const configuration = new Configuration({
        apiKey: gptConfig?.gptApiKey || "",
    });

    openai = new OpenAIApi(configuration);
});

/**
 * Calls the GPT-3 API with the given query.
 * @param query Query string
 * @returns The response from the GPT-3 API
 */
const _askGpt3 = async (query) => {
    const { gptConfig } = await chrome.storage.local.get("gptConfig");

    try {
        const response = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: query,
            temperature: gptConfig.gptTemperature || 0,
            max_tokens: gptConfig.gptMaxTokens || 7,
        });

        return response.data.choices[0].text;
    } catch (e) {
        console.error(':: Error calling the GPT-3 API', e);
        return "** An error occurred when calling GPT-3.<br/>** Did you configure GPT-3 in the config pane?";
    };
};

/**
 * Checks if the user pressed enter, and if the content starts with "hey gpt,"
 * to make an api call to gpt-3 with the last line of the content as the query.
 * @param {*} evt Keyboard event
 * @param {*} element Scrintal editor content element
 */
const _onKeyDown = (evt) => {
    const element = evt.target;

    if (evt.keyCode === 13) {
        // Get the last line of the content
        const content = element.innerText.trim().split("\n").pop();

        // Check if the content starts with "hey gpt,"
        if (content.toLowerCase().startsWith("hey gpt,")) {
            const lastElement = element.lastElementChild;

            // Insert a "please wait" message into the card
            const pleaseWait = document.createElement("p");
            pleaseWait.innerHTML = 'Please wait...';

            lastElement.insertAdjacentElement("beforebegin", pleaseWait);

            // Remove the trigger text "hey gpt," of the query
            const query = content.slice(8).trim();

            // Call the gpt-3 api
            _askGpt3(query).then((text) => {
                // Remove the "please wait" message, because we got a response
                lastElement.remove();

                // Insert the response into the card
                element.insertAdjacentHTML("beforeend", `<blockquote>${text}</blockquote><p></p>`);

                // Set the cursor to the card's end, so the user can continue typing
                element.focus();
                window.getSelection().selectAllChildren(element);
                window.getSelection().collapseToEnd();
            });
        }
    }
};

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message) => {

    // We got this message from the background script, so we can insert the template string
    if (message.type === "init") {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === "childList") {

                    // We only want to insert the template string, if the card content is loaded
                    if (mutation.target.nodeType !== Node.ELEMENT_NODE) return;
                    const target = mutation.target as HTMLElement;

                    // Detect, if the card is opened or closed
                    if (target.classList.contains('ProseMirror') && !mutation.previousSibling && !alreadyInitialized) {
                        // console.log(":: CARD OPENED", mutation);

                        // Set the flag, so we don't add the event listener multiple times
                        alreadyInitialized = true;

                        // Add the event listener
                        mutation.target.addEventListener("keydown", _onKeyDown);

                    } else if (
                        // Filtering out the mutation, when the card is closed
                        mutation.removedNodes.length > 0 &&
                        target.classList.contains("editor-container") &&
                        (mutation.previousSibling as HTMLElement).classList.contains("ProseMirror")
                    ) {
                        // console.log(":: CARD CLOSED", mutation);

                        // Reset the flag, so we can add the event listener again, when the card is opened
                        alreadyInitialized = false;

                        // Remove the event listener
                        mutation.previousSibling.removeEventListener("keydown", _onKeyDown);
                    }
                }
            });
        });

        // Observe the body element, so we can detect when the card content is loaded
        const root = document.querySelector("#root");
        observer.observe(root, {
            childList: true,
            subtree: true,
        });

        // Wait a second, so the async page content has time to load
        setTimeout(async () => {
            // Find the .ProseMirror element, and insert the template string
            // TODO: Find a stable way to find the element
            const element = document.querySelector('.ProseMirror');
            if (!element) {
                console.info(":: got message from background script, but no card element found.");
                return;
            }

            // We grab the template string from the local storage we stored on
            // creation of the card
            const templateContent = await chrome.storage.local.get("insertTemplate");

            // No template string means, it wasn't a card creation task, so we don't insert anything
            if (!templateContent || !templateContent.insertTemplate.length) return;

            // Clear the template string, so we don't insert it again
            chrome.storage.local.set({ insertTemplate: "" });

            // Insert the template into the card
            const lastElement = element.lastElementChild;
            lastElement.insertAdjacentHTML("beforebegin", templateContent.insertTemplate);
        }, 1000);
    }
});
