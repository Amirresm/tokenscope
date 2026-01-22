import { signal } from "@preact/signals-react";
import { METRICLABELS } from "../../constants/labels";

export enum ColorVerbosityEnum {
    VERBOSE = "verbose",
    NORMAL = "normal",
    NONE = "none",
}

export const TokenMetrics = {
    confidence: { label: METRICLABELS.confidence },
    marginConfidence: { label: METRICLABELS.marginConfidence },
    entropy: { label: METRICLABELS.entropy },
    perplexity: { label: METRICLABELS.perplexity },
    lastPerplexity: { label: METRICLABELS.lastPerplexity },
    attentionSaliency: {
        label: `${METRICLABELS.attentionSaliency} (For Selected Head)`,
    },
} as const;

type TokenLevelViewConfigType = {
    colorVerbosity: ColorVerbosityEnum;
    specialTokenFilter: boolean;
    showLineInfo: boolean;
    tokenMetric: keyof typeof TokenMetrics;
};

const tokenLevelViewConfigSignal = signal<TokenLevelViewConfigType>({
    colorVerbosity: ColorVerbosityEnum.NORMAL,
    specialTokenFilter: true,
    showLineInfo: false,
    tokenMetric: "confidence",
});

function updateTokenLevelViewConfig(
    newConfig: Partial<TokenLevelViewConfigType>,
) {
    tokenLevelViewConfigSignal.value = {
        ...tokenLevelViewConfigSignal.value,
        ...newConfig,
    };
}

const resetTokenLevelViewConfig = () => {
    tokenLevelViewConfigSignal.value = {
        colorVerbosity: ColorVerbosityEnum.NORMAL,
        specialTokenFilter: true,
        showLineInfo: false,
        tokenMetric: "confidence",
    };
};

export default {
    config: tokenLevelViewConfigSignal,
    updateConfig: updateTokenLevelViewConfig,
    resetConfig: resetTokenLevelViewConfig,
};
