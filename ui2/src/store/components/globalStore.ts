import { signal } from "@preact/signals-react";

const viewMode = signal<"generation" | "graph" | "ast">("generation");

export default {
    viewMode,
};

