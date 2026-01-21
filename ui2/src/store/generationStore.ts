import { computed, signal } from "@preact/signals-react";
import {
    GenerationToken,
    getGenerationTokenSortBias,
} from "../models/generationToken";

const currentGeneration = signal<GenerationToken[]>([]);
const hasGeneration = computed(() => currentGeneration.value.length > 0);

const paused = signal<boolean>(false);
const isGenerating = signal<boolean>(false);
const generationAbort = signal<AbortController>();

export type GenerationSettings = {
    maxTokens: number;
    topK: number;
    topP: string;
    temp: string;
    alternatives: number;
    attentionLayer: number;
    attentionTopN: number;
};
const generationSettings = signal<GenerationSettings>({
    maxTokens: 256,
    topK: 1,
    topP: "1",
    temp: "1",
    alternatives: 5,
    attentionLayer: -1,
    attentionTopN: 10,
});

const updateGenerationSettings = (newSettings: Partial<GenerationSettings>) => {
    generationSettings.value = {
        ...generationSettings.value,
        ...newSettings,
    };
};

function clearGeneration() {
    currentGeneration.value = [];
}

function appendToGeneration(token: GenerationToken) {
    let newGeneration = [...currentGeneration.value, token];
    newGeneration = newGeneration.sort(
        (a, b) =>
            a.position -
            b.position +
            getGenerationTokenSortBias(a) -
            getGenerationTokenSortBias(b),
    );
    newGeneration = newGeneration.map((token, index) => ({ ...token, index }));

    let lineNumber = 1;
    let startOfLineTokenIndex = 0;
    let cummulativeConfidence = 0;
    let lineTokensCount = 0;
    for (let i = 0; i < newGeneration.length; i++) {
        lineTokensCount += 1;
        cummulativeConfidence += newGeneration[i].confidence;
        if (newGeneration[i].token.includes("\n")) {
            newGeneration[startOfLineTokenIndex].lineConfidence =
                cummulativeConfidence / lineTokensCount;
            newGeneration[startOfLineTokenIndex].lineNumber = lineNumber;
            cummulativeConfidence = 0;
            lineTokensCount = 0;
            startOfLineTokenIndex = i + 1;
            lineNumber += 1;
        }
    }
    if (newGeneration.length > startOfLineTokenIndex) {
        newGeneration[startOfLineTokenIndex].lineConfidence =
            cummulativeConfidence / lineTokensCount;
        newGeneration[startOfLineTokenIndex].lineNumber = lineNumber;
    }

    currentGeneration.value = newGeneration;
}

const selectedToken = signal<GenerationToken>();
const nextToken = computed(() => {
    const generation = currentGeneration.value;
    const sToken = selectedToken.value;
    if (!hasGeneration.value || !sToken) return null;
    const index = generation.findIndex(
        (token) => token.position === sToken.position,
    );
    return generation[index + 1];
});
const previousToken = computed(() => {
    const generation = currentGeneration.value;
    const sToken = selectedToken.value;
    if (!hasGeneration.value || !sToken) return null;
    const index = generation.findIndex(
        (token) => token.position === sToken.position,
    );
    return generation[index - 1];
});
const lastGeneratedToken = computed(() => {
    const generation = currentGeneration.value;
    if (!hasGeneration.value) return null;
    return generation[generation.length - 1];
});

const confidenceDomain = signal<[number, number]>([-1, 1]);
const perplexityDomain = signal<[number, number]>([-1, Infinity]);
const lastPerplexityDomain = signal<[number, number]>([-1, Infinity]);
const confidenceTenPercentiles = signal<number[]>([]);
const perplexityTenPercentiles = signal<number[]>([]);
const lastPerplexityTenPercentiles = signal<number[]>([]);
const marginConfidenceTenPercentiles = signal<number[]>([]);
const entropyTenPercentiles = signal<number[]>([]);

const attentionSaliencyTenPercentiles = signal<Record<string, number[]>>({});

const fimStartToken = signal<number | null>(null);
const fimEndToken = signal<number | null>(null);

const clearFimState = () => {
    fimStartToken.value = null;
    fimEndToken.value = null;
};

const setFimStartToken = (token: number) => {
    fimStartToken.value = token;
};
const setFimEndToken = (token: number) => {
    fimEndToken.value = token;
};

const updateFimIndices = (index: number) => {
    if (fimStartToken.value === null) {
        fimStartToken.value = index;
    } else if (fimEndToken.value === null) {
        fimEndToken.value = index;
    } else {
        fimStartToken.value = index;
        fimEndToken.value = null;
    }
};

const attentionTargetHead = signal<string | undefined>("mean");
const attentionTargetToken = signal<GenerationToken | null>(null);
const attentionVisibleRange = signal<[number, number]>([0, 1]);

function updateAttentionTargetToken(
    attentionHead: string | undefined,
    attentionToken: GenerationToken,
) {
    if (!attentionHead) return;
    if (attentionToken) {
        const attentions = attentionToken.attentionSnapshot?.[attentionHead];
        if (attentions) {
            currentGeneration.value = currentGeneration.value.map(
                (t, index) => {
                    const attn = attentions.find(
                        (a) => a.index === index,
                    )?.attention;
                    t.relativeAttention = attn;
                    return t;
                },
            );
            const minAttention = Math.min(
                ...attentions.map((a) => a.attention),
            );
            const maxAttention = Math.max(
                ...attentions.map((a) => a.attention),
            );
            attentionVisibleRange.value = [minAttention, maxAttention];
        }
    }
}

const setAttentionTargetHead = (head: string) => {
    attentionTargetHead.value = head;
    if (attentionTargetToken.value) {
        updateAttentionTargetToken(head, attentionTargetToken.value);
    }
};
const setAttentionTargetToken = (token: GenerationToken) => {
    if (token.position === attentionTargetToken.value?.position) {
        attentionTargetToken.value = null;
        attentionVisibleRange.value = [0, 1];
        currentGeneration.value = currentGeneration.value.map((t) => {
            t.relativeAttention = undefined;
            return t;
        });
    } else {
        attentionTargetToken.value = token;
        updateAttentionTargetToken(attentionTargetHead.value, token);
    }
};
const clearAttentionTargetToken = () => {
    attentionTargetToken.value = null;
    attentionVisibleRange.value = [0, 1];
    currentGeneration.value = currentGeneration.value.map((t) => {
        t.relativeAttention = undefined;
        return t;
    });
};

const resetGenerationStore = () => {
    clearGeneration();
    selectedToken.value = undefined;

    confidenceDomain.value = [-1, 1];
    perplexityDomain.value = [-1, Infinity];
    lastPerplexityDomain.value = [-1, Infinity];
    confidenceTenPercentiles.value = [];
    perplexityTenPercentiles.value = [];
    lastPerplexityTenPercentiles.value = [];
    marginConfidenceTenPercentiles.value = [];
    entropyTenPercentiles.value = [];

    clearFimState();

    attentionTargetToken.value = null;
    attentionTargetHead.value = "mean";
    attentionVisibleRange.value = [0, 1];

    paused.value = false;
    isGenerating.value = false;
    generationAbort.value = undefined;
};

export default {
    generationSettings,
    updateGenerationSettings,

    currentGeneration,
    clearGeneration,
    appendToGeneration,

    selectedToken,
    nextToken,
    previousToken,
    lastGeneratedToken,

    confidenceDomain,
    perplexityDomain,
    lastPerplexityDomain,
    confidenceTenPercentiles,
    perplexityTenPercentiles,
    lastPerplexityTenPercentiles,
    marginConfidenceTenPercentiles,
    entropyTenPercentiles,
    attentionSaliencyTenPercentiles,

    attentionTargetToken,
    attentionTargetHead,
    attentionVisibleRange,
    setAttentionTargetToken,
    setAttentionTargetHead,
    updateAttentionTargetToken,
    clearAttentionTargetToken,

    hasGeneration,

    paused,
    isGenerating,
    generationAbort,

    fimStartToken,
    fimEndToken,
    clearFimState,
    setFimStartToken,
    setFimEndToken,
    updateFimIndices,

    resetGenerationStore,
};
