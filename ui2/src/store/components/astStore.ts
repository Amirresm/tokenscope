import { signal } from "@preact/signals-react";

const selectedRange = signal<{ start: number; end: number } | null>(null);

export default {
    selectedRange,
};
