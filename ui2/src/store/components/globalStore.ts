import { signal } from "@preact/signals-react";

const viewMode = signal<"generation" | "graph">("generation");

export default {
    viewMode,
};

