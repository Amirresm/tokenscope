import { signal } from "@preact/signals-react";

export enum ColorVerbosityEnum {
    VERBOSE = "verbose",
    NORMAL = "normal",
    NONE = "none",
}

export const TokenMetrics = {
    confidence: { label: "Confidence" },
    perplexity: { label: "Perplexity" },
    lastPerplexity: { label: "Last Perplexity" },
    marginConfidence: { label: "Margin Confidence" },
    entropy: { label: "Entropy" },
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

export default {
    config: tokenLevelViewConfigSignal,
    updateConfig: updateTokenLevelViewConfig,
};
