/** 
 * Dispatch event on click outside of node 
 * Don't forget necessary type declaration in src/app.d.ts :)
 */
export const clickOutside = (node: HTMLElement) => {

    const handlePointerUp = (event: PointerEvent) => {
        const target = event.target as HTMLElement;
        if (event.target && node && !node.contains(target) && !event.defaultPrevented) {
            node.dispatchEvent(
                new CustomEvent('click_outside', { detail: event })
            );
        }
    };

    document.addEventListener('pointerup', handlePointerUp, true);

    return {
        destroy() {
            document.removeEventListener('pointerup', handlePointerUp, true);
        }
    };
};
