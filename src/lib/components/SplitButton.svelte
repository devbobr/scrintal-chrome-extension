<script lang="ts">
    import { clickOutside } from '../../lib/clickOutside';
    import { createEventDispatcher } from 'svelte';

    export let label: string = 'Primary';
    export let menuItems: Map<any, any> = new Map();

    // Dispatcher for selection changes
    const dispatch = createEventDispatcher();

    // Menu open state
    let menuIsOpen = false;

    // Debug only
    // menuItems.set('item1', () => console.log('item1'));
    // menuItems.set('item 2', () => console.log('item1'));

    // Click outside handler to close menu when clicked outside
    const _onOutsideClicked = (evt: Event) => {
        menuIsOpen = false;
    };
</script>

<span use:clickOutside on:click_outside={_onOutsideClicked}>
    <div
        class="flex"
        aria-roledescription="split button"
        aria-disabled="false"
        data-is-focusable="true"
        role="button"
        aria-haspopup="true"
        aria-expanded="false"
        tabindex="0"
    >
        <span style="display: flex; width: 100%;">
            <button
                class={`${$$props.class} ml-auto rounded-r-none border-r-0 hover:enabled:border-r-0`}
                type="button"
                aria-roledescription="split button"
                data-is-focusable="false"
                tabindex="-1"
                on:click
            >
                <span> {label} </span>
            </button>
            <button
                on:pointerup={() => (menuIsOpen = true)}
                class="rounded-l-none p-1"
                disabled={menuItems.size === 0}
                type="button"
                aria-haspopup="true"
                aria-expanded="false"
                data-is-focusable="false"
                tabindex="-1"
                aria-label="See 2 options"
            >
                <svg
                    fill={menuItems.size === 0 ? 'var(--colors-outline3)' : 'default'}
                    class="w-3 h-3"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 2048 2048"
                    focusable="false"
                    ><path d="M1939 467l90 90-1005 1005L19 557l90-90 915 915 915-915z" /></svg
                >
            </button>
            <span aria-hidden="true" />
        </span>
        <ul
            class:hidden={!menuIsOpen}
            class="absolute right-0 select-none mt-8 mr-2 w-48 bg-white rounded-md overflow-hidden shadow-xl z-20"
        >
            {#each [...menuItems] as [label, onClick]}
                <li
                    class="block px-4 py-1 text-sm text-gray-800 border-b hover:bg-gray-200"
                    on:pointerup={(evt) => {
                        // Inform parent of selection and close menu
                        dispatch('selectionChanged', label);
                        menuIsOpen = false;
                    }}
                >
                    {label}
                </li>
            {/each}
        </ul>
    </div>
</span>
