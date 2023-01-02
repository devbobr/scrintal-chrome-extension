<script lang="ts">
    import './global.css';
    import type { GPTConfig, TabItem } from './lib/types';
    import { onMount } from 'svelte';
    import manifest from '../manifest.json';

    import SplitButton from './lib/components/SplitButton.svelte';
    import Tabs from './lib/components/Tabs.svelte';

    type TemplateMap = Map<string, string>; // map.set(title, content.innerHTML);
    type TemplateStore = {
        templates: TemplateMap;
    };

    // UI Tab configuration
    const tabConfig = [
        {
            name: 'createNote',
            title: 'New Note',
        },
        {
            name: 'createTemplate',
            title: 'Create Template',
        },
        {
            name: 'insertTemplate',
            title: 'Insert Template',
        },
        {
            name: 'config',
            title: 'Configuration',
        },
    ] as TabItem[];

    // Refernces to the DOM elements
    let selInsertTemplateSelect: HTMLSelectElement;
    let mnuSplitButton: SplitButton;

    // Map of all templates stored in the local storage
    let templateMap = new Map();

    // Selected templates
    let insertTemplate = '';
    let newPageTitle = '';
    let newPageTemplate = '';

    // Flag to check if a Scrintal card is currently available
    let cardIsAvailable = false;

    // Computed value to display the description for a new note
    let createNoteDescription = '';

    // GPT-3 config values
    let gptApiKey = '';
    let gptMaxTokens = 0;
    let gptTemperature = 0;

    // Tasks to be executed on page load
    onMount(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Initial loading select options
        const tpls = await chrome.storage.local.get('templates');
        templateMap = new Map(tpls.templates);

        const cfg = await chrome.storage.local.get('gptConfig');
        const gptConfig = cfg.gptConfig as GPTConfig;
        gptApiKey = gptConfig?.gptApiKey || '';
        gptMaxTokens = gptConfig?.gptMaxTokens || 10;
        gptTemperature = gptConfig?.gptTemperature || 0.7;

        // Check if a Scrintal card is available
        const result = await chrome.scripting.executeScript({
            args: [],
            target: { tabId: tab.id || 0 },
            func: () => {
                // TODO: Find a stable way to get the content
                const titleTag = document.querySelector('h1[contenteditable=true]');
                const content = document.querySelector('.ProseMirror');

                return titleTag !== null && content !== null;
            },
        });
        console.log(':: card avoailable check', result);

        // Set the flag to keep track if a Scrintal card is available
        cardIsAvailable = result[0].result;
    });

    /**
     * Replaces internal variables with the actual values
     * Currently only {{today}} is supported and will be replaced
     * with the current date in locale long format
     * @param template The template string
     * @returns The template string with replaced variables
     */
    const _replaceAllVars = (template: string) => {
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        };

        return template.replace(
            /{{today}}/g,
            new Date().toLocaleDateString(undefined, options)
        );
    };

    /**
     * Creates a new template from the current card
     */
    const onCreateTemplate = async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        chrome.scripting.executeScript({
            args: [],
            target: { tabId: tab.id || 0 },
            func: () => {
                // TODO: Find a stable way to get the content
                const titleTag = document.querySelector('h1[contenteditable=true]');
                const contentRef = document.querySelector('.ProseMirror');

                // We have to deep copy, otherwise we change the original card content
                const content = contentRef
                    ? (document.importNode(contentRef, true) as HTMLElement)
                    : null;

                if (!titleTag || !content) {
                    console.error(':: getTemplate ::', 'No title or content found.');
                    return;
                }

                // CLEANUP THE CONTENT BEFORE STORING IT
                // Menu comes with images, which are not working in the template at the moment
                const divWithButtons = content.querySelectorAll('div.menu');
                if (divWithButtons) {
                    divWithButtons.forEach((item) => item.remove());
                }

                // Menu comes with files, which are not working in the template at the moment
                const divWithFiles = content.querySelectorAll('div.file');
                if (divWithFiles) {
                    divWithFiles.forEach((item) => item.remove());
                }

                // Remove all images by now
                const divWithImages = content.querySelectorAll('img');
                if (divWithImages) {
                    divWithImages.forEach((item) => item.remove());
                }

                // Use the title of the card as the template title
                const title = titleTag.textContent || 'Untitled Card';

                // Updating the local template storage
                chrome.storage.local.get('templates', (data) => {
                    const store = data as TemplateStore;

                    // Create a new template map
                    const map = new Map(store.templates);
                    map.set(title, content.innerHTML);

                    // Storing the new template set
                    chrome.storage.local.set({ templates: [...map] });
                });
            },
        });

        // Close the popup
        window.close();
    };

    /**
     * Creates a new card with the selected template
     */
    const onNewNote = () => {
        const trimmedTitle = newPageTitle.trim();

        // Replace internal variables
        const title = trimmedTitle.length ? _replaceAllVars(trimmedTitle) : 'Untitled';

        // Create the URL for the new card
        const url = `https://beta.scrintal.com/app/card/create?title=${title}`;

        // Set the content of the new card, which will be inserted on the new card
        // via the content script
        const template = templateMap.get(newPageTemplate);

        // Replace internal variables
        const content = template ? _replaceAllVars(template) : '';

        // Store the content in the local storage for later use in the content script
        chrome.storage.local.set({ insertTemplate: content });

        // Open the new card in a new tab
        chrome.tabs.update({ active: true, url });

        // Close the popup
        window.close();
    };

    /**
     * Inserts the selected template into the current card
     */
    const onPasteTemplate = async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const template = templateMap.get(insertTemplate);

        // Replace internal variables
        const content = template ? _replaceAllVars(template) : '';

        chrome.scripting.executeScript({
            target: { tabId: tab.id! },
            func: (content) => {
                // TODO: Find a stable way to get the content anker
                const contentAnker = document.querySelector('.ProseMirror');

                if (!contentAnker) {
                    console.error(':: onPasteTemplate ::', 'No content anker found.');
                    return;
                }

                // Insert the template content into the card
                contentAnker.insertAdjacentHTML('afterbegin', content);
            },
            args: [content],
        });

        // Close the popup
        window.close();
    };

    /**
     * Clears all templates from the local storage
     */
    const onClearAllTemplates = () => {
        // Reset the local template storage
        chrome.storage.local.set({ templates: [] });

        // Reset the template map
        templateMap = new Map();

        // Reset the select element
        selInsertTemplateSelect.innerHTML = '';

        // Close the popup
        window.close();
    };

    /**
     * Saves the GPT config to the local storage
     */
    const onSaveGPTConfig = async () => {
        const gptConfig: GPTConfig = {
            gptApiKey,
            gptMaxTokens,
            gptTemperature,
        };

        await chrome.storage.local.set({ gptConfig });
    };

    // Computes if there are any templates available
    $: hasTemplates = templateMap.size > 0;

    // Updates the options for the template select when inserting a template
    $: {
        if (selInsertTemplateSelect) {
            templateMap.forEach((_, key) => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.innerHTML = key;
                selInsertTemplateSelect.appendChild(opt);
            });

            // Setting the first template as selected
            insertTemplate = selInsertTemplateSelect.value || '';
        }
    }

    // Computes the description for a new note based on the selected template and title
    $: {
        const tpm = newPageTemplate.length
            ? `a new page using template '${newPageTemplate}'`
            : 'an empty page';
        createNoteDescription = `Creating ${tpm} with the title '${
            newPageTitle.length ? _replaceAllVars(newPageTitle) : 'Untitled'
        }'`;
    }
</script>

<div class="page relative light max-w-[700px]">
    <div class="pt-4">
        <h1 class="text-xl mb-12">Scrintal Template Manager</h1>

        <Tabs slots={tabConfig}>
            <div data-slot="createNote">
                <div class="section mt-12 mb-4">
                    <div class="dividerText">Create new Note</div>
                    <div class="field flex flex-col">
                        <div class="flex">
                            <input
                                bind:value={newPageTitle}
                                type="text"
                                placeholder="Enter the title of your new note here"
                                class="input h-6 input-bordered w-full max-w-xs"
                            />

                            <span class="ml-4"
                                ><SplitButton
                                    on:selectionChanged={(tplName) => {
                                        newPageTemplate = tplName.detail;
                                    }}
                                    bind.this={mnuSplitButton}
                                    menuItems={templateMap}
                                    on:click={onNewNote}
                                    class="w-44"
                                    label={newPageTemplate.length
                                        ? 'Note with template'
                                        : 'Blank Note'}
                                /></span
                            >
                        </div>
                        <div
                            class="text-[var(--colors-primaryText)] text-xs mt-4 p-4 border-l-4 border-[var(--colors-onPrimaryContainer2)]"
                        >
                            {createNoteDescription}
                        </div>
                    </div>

                    {#if newPageTemplate.length}
                        <div class="dividerText my-4">Preview</div>
                        <div class="bg-[var(--colors-containerActive)] p-4">
                            <div class="prose-sm">
                                {@html _replaceAllVars(templateMap.get(newPageTemplate))}
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
            <div data-slot="createTemplate">
                <div class="section">
                    <div class="dividerText">Create A New Template</div>
                    {#if !cardIsAvailable}
                        <div class="text-violet-700 text-xs">
                            Cannot create template because no card is open
                        </div>
                    {/if}
                    <div>
                        <button disabled={!cardIsAvailable} on:click={onCreateTemplate}>
                            Save Card Content as Template
                        </button>
                    </div>
                </div>
            </div>
            <div data-slot="insertTemplate">
                <div class="section">
                    <div class="dividerText">Your Templates</div>
                    {#if !hasTemplates}
                        <div class="text-violet-700 text-xs">
                            You haven't defined any templates yet.
                        </div>
                    {/if}
                    {#if !cardIsAvailable}
                        <div class="text-violet-700 text-xs">
                            Cannot insert template because no card is open
                        </div>
                    {/if}
                    <div class="field flex flex-row">
                        {#if !hasTemplates}
                            <div />
                        {:else}
                            <select
                                on:change={(e) => (insertTemplate = e.currentTarget.value)}
                                bind:this={selInsertTemplateSelect}
                            >
                                <option value="">Select a template</option>
                            </select>
                        {/if}

                        <button
                            class="ml-4"
                            disabled={!cardIsAvailable ||
                                !hasTemplates ||
                                !insertTemplate.length}
                            on:click={onPasteTemplate}
                        >
                            Insert Template
                        </button>
                    </div>
                </div>

                {#if insertTemplate.length}
                    <div class="dividerText my-4">Preview</div>
                    <div class="bg-[var(--colors-containerActive)] p-4">
                        <div class="prose-sm">
                            {@html _replaceAllVars(templateMap.get(insertTemplate))}
                        </div>
                    </div>
                {/if}
            </div>
            <div data-slot="config">
                <div class="section">
                    <div class="dividerText">GPT-3 Configuration</div>

                    <div class="field">
                        <label class="w-36" for="gpt3ApiKey">GPT-3 API Key</label>
                        <input
                            id="gpt3ApiKey"
                            type="password"
                            bind:value={gptApiKey}
                            class="w-1/2"
                        />
                    </div>
                    <div class="field">
                        <label class="w-36" for="maxTokens">Max Tokens</label>
                        <input
                            id="maxTokens"
                            type="number"
                            bind:value={gptMaxTokens}
                            class="w-1/2"
                        />
                    </div>
                    <div class="field">
                        <label class="w-36" for="temperature">Temperature</label>
                        <input
                            id="temperature"
                            type="number"
                            step="0.1"
                            bind:value={gptTemperature}
                            class="w-1/2"
                        />
                    </div>

                    <button on:click={onSaveGPTConfig}>Save GPT-3 Config</button>
                </div>
                <div class="section">
                    <div class="dividerText !text-red-700">Danger Zone</div>
                    <button on:click={onClearAllTemplates}
                        >Clear All Templates From Store</button
                    >
                </div>
                <div class="pt-12 pb-2 text-center">version {manifest.version}</div>
            </div>
        </Tabs>
    </div>

    <div
        on:pointerup={() => window.close()}
        class="absolute top-3 right-3 text-2xl cursor-pointer select-none"
    >
        &times;
    </div>
</div>

<style>
    .field {
        @apply flex pl-8 pb-2;
    }
    .page {
        min-width: 600px;
        margin: 0 auto;
        padding: 1em;

        background-color: var(--colors-uiSurface);
    }
</style>
