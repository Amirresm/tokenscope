import { signal } from "@preact/signals-react";
import { GenerationTokenData } from "../../models/generationToken";

export enum ASTColorVerbosityEnum {
    NORMAL = "normal",
    CONFIDENCE = "confidence",
}

export enum ViewModesEnum {
    Type = "Type",
    Category = "Category",
    Group = "Group",
    // Block = "block",
    LineNumber = "Line Number",
    // AtomicBlock = "atomicBlock",
    AtomicBlock2 = "Block",
}

const astViewMode = signal<ViewModesEnum>(ViewModesEnum.Type);
const astColorVerbosity = signal<ASTColorVerbosityEnum>(ASTColorVerbosityEnum.NORMAL);

const selectedRange = signal<{ start: number; end: number } | null>(null);

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
    astViewMode,
    astColorVerbosity,
    selectedRange,
    avgAttentionMap,
    astGroups,
};
