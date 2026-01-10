import { signal } from "@preact/signals-react";

export enum ViewModesEnum {
    Type = "Type",
    Category = "Category",
    Group = "Group",
    // Block = "block",
    LineNumber = "Line Number",
    // AtomicBlock = "atomicBlock",
    AtomicBlock2 = "Block",
}

const selectedRange = signal<{ start: number; end: number } | null>(null);
const astViewMode = signal<ViewModesEnum>(ViewModesEnum.Type);

export default {
    selectedRange,
    astViewMode,
};
