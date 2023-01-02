<script lang="ts">
    import type { TabItem } from '../../lib/types';

    export let slots: TabItem[] = [];

    // Keeps track of the active tab
    let activeTab = slots[0].name;

    // Reference to the slot element
    let theSlots: HTMLSpanElement;

    // When the active tab changes, show the corresponding slot
    $: {
        if (theSlots) {
            const slot = theSlots.querySelectorAll(`[data-slot]`);
            slot.forEach((el) => {
                if (el.getAttribute('data-slot') === activeTab) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            });
        }
    }
</script>

<div
    class="mb-8 text-sm font-medium text-center text-gray-500 border-b border-gray-200 dark:text-gray-400 dark:border-gray-700"
>
    <ul class="flex flex-wrap -mb-px">
        {#each slots as slot}
            <li class="mr-2">
                <div
                    on:pointerup={() => {
                        activeTab = slot.name;
                    }}
                    class={slot.name === activeTab
                        ? 'cursor-pointer select-none inline-block p-4 text-violet-600 rounded-t-lg border-b-2 border-violet-600 active dark:text-violet-500 dark:border-violet-500" aria-current="page"'
                        : 'cursor-pointer select-none inline-block p-4 rounded-t-lg border-b-2 border-transparent hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300'}
                >
                    {slot.title}
                </div>
            </li>
        {/each}
    </ul>
</div>

<span bind:this={theSlots}><slot /></span>
