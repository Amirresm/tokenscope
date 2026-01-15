import { signal } from "@preact/signals-react";
import { GenerationTokenData } from "../../models/generationToken";

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

const avgAttentionMap = signal<Record<string, Record<string, number[]>>>({});

const astGroups = signal<
    {
        index: number;
        id: string;
        tokens: GenerationTokenData[];
        group: string;
        averageConfidence: number;
    }[]
>([]);

export default {
    selectedRange,
    astViewMode,
    avgAttentionMap,
    astGroups,
};
