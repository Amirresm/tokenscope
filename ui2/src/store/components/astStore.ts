import { signal } from "@preact/signals-react";
import {
    GenerationToken,
} from "../../models/generationToken";
import { EnrichedAstTokenInfo } from "../../models/ast";

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

export const ASTViewModeLabels = {
    [ViewModesEnum.Type]: "Token",
    [ViewModesEnum.Category]: "Expression",
    [ViewModesEnum.Group]: "Statement",
    [ViewModesEnum.LineNumber]: "Line Number",
    [ViewModesEnum.AtomicBlock2]: "Block",
};

const astViewMode = signal<ViewModesEnum>(ViewModesEnum.Type);
const astColorVerbosity = signal<ASTColorVerbosityEnum>(
    ASTColorVerbosityEnum.NORMAL,
);

const selectedRange = signal<{ start: number; end: number } | null>(null);

const enrichedAstTokens = signal<EnrichedAstTokenInfo[] | undefined>(undefined);

const avgAttentionMap = signal<Record<string, Record<string, number[]>>>({});

const astGroups = signal<
    {
        index: number;
        id: string;
        tokens: GenerationToken[];
        group: string;
        averageConfidence: number;
    }[]
>([]);

const resetAstStore = () => {
    enrichedAstTokens.value = undefined;
    astViewMode.value = ViewModesEnum.Type;
    astColorVerbosity.value = ASTColorVerbosityEnum.NORMAL;
    selectedRange.value = null;
    avgAttentionMap.value = {};
    astGroups.value = [];
};

export default {
    enrichedAstTokens,
    astViewMode,
    astColorVerbosity,
    selectedRange,
    avgAttentionMap,
    astGroups,
    resetAstStore,
};
