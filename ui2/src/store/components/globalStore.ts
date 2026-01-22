import { signal } from "@preact/signals-react";

const viewMode = signal<"generation" | "graph" | "ast">("generation");

const resetGlobalStore = () => {
    viewMode.value = "generation";
};

export default {
    viewMode,
    resetGlobalStore,
};
