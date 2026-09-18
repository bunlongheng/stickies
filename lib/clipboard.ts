// Clipboard copy with a legacy fallback - extracted from app/(app)/page.tsx.
// Uses the async Clipboard API in secure contexts, otherwise a hidden-textarea
// execCommand("copy") fallback. Always resolves; never throws to the caller.
export const secureCopy = (text: string): Promise<void> => {
    if (navigator.clipboard && window.isSecureContext) {
        (document.activeElement as HTMLElement)?.blur();
        return navigator.clipboard.writeText(text);
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand("copy");
    } catch (err) {
        console.error("Copy fallback failed", err);
    }
    textArea.blur();
    document.body.removeChild(textArea);
    return Promise.resolve();
};
