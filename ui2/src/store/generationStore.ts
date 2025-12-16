import { computed, signal } from "@preact/signals-react";

export type GenerationToken = {
    index: number;
    token: string;
    tokenId: number;
    confidence: number;
    allTokensIds: number[];
    allTokens: string[];
    allConfidences: number[];
    alternativeTokens?: GenerationToken[];
    tags: string[];
    stop?: boolean;
    prompt?: boolean;
    manual?: boolean;
    // attentionSnapshot?: number[][];
    attentionSnapshot?: { index: number; attention: number }[][];
    branchId: string;

    // Local attributes
    lineNumber?: number;
    lineConfidence?: number;
    relativeAttention?: number;
};

const getSortBias = (token: GenerationToken) => {
    let bias = 0;
    if (token.tags.includes("prefix")) bias -= 10000;
    if (token.tags.includes("suffix")) bias += 10000;
    return bias;
};

const currentGenerationSignal = signal<GenerationToken[]>([]);

function clearGeneration() {
    currentGenerationSignal.value = [];
}

function appendToGeneration(token: GenerationToken) {
    let newGeneration = [...currentGenerationSignal.value, token];
    newGeneration = newGeneration.sort(
        (a, b) => a.index - b.index + getSortBias(a) - getSortBias(b),
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

    currentGenerationSignal.value = newGeneration;
}

function finalizeGeneration() {}

const sessionId = signal<string | null>(null);
const setSessionId = (id: string) => {
    sessionId.value = id;
}
const branchId = signal<string | null>(null);
const setBranchId = (id: string | null) => {
    branchId.value = id;
}

const viewMode = signal<"generation" | "graph">("generation");

const selectedToken = signal<GenerationToken>();
const nextToken = computed(() => {
    const generation = currentGenerationSignal.value;
    const sToken = selectedToken.value;
    if (generation.length === 0 || !sToken) return null;
    const index = generation.findIndex((token) => token.index === sToken.index);
    return generation[index + 1];
});
const previousToken = computed(() => {
    const generation = currentGenerationSignal.value;
    const sToken = selectedToken.value;
    if (generation.length === 0 || !sToken) return null;
    const index = generation.findIndex((token) => token.index === sToken.index);
    return generation[index - 1];
});
const lastGeneratedTokenSignal = computed(() => {
    const generation = currentGenerationSignal.value;
    if (generation.length === 0) return null;
    return generation[generation.length - 1];
});

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

const attentionTargetHead = signal<number>(0);
const attentionTargetToken = signal<GenerationToken | null>(null);
const attentionVisibleRange = signal<[number, number]>([0, 1]);

function updateAttentionTargetToken(
    attentionHead: number,
    attentionToken: GenerationToken,
) {
    if (attentionToken) {
        const attentions = attentionToken.attentionSnapshot?.[attentionHead];
        if (attentions) {
            currentGenerationSignal.value = currentGenerationSignal.value.map(
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

const setAttentionTargetHead = (head: number) => {
    attentionTargetHead.value = head;
    if (attentionTargetToken.value) {
        updateAttentionTargetToken(head, attentionTargetToken.value);
    }
};
const setAttentionTargetToken = (token: GenerationToken) => {
    if (token.index === attentionTargetToken.value?.index) {
        attentionTargetToken.value = null;
        attentionVisibleRange.value = [0, 1];
        currentGenerationSignal.value = currentGenerationSignal.value.map(
            (t) => {
                t.relativeAttention = undefined;
                return t;
            },
        );
    } else {
        attentionTargetToken.value = token;
        updateAttentionTargetToken(attentionTargetHead.value, token);
    }
};

export default {
    sessionId,
    setSessionId,
    branchId,
    setBranchId,

    viewMode,

    currentGenerationSignal,
    clearGeneration,
    appendToGeneration,
    finalizeGeneration,

    selectedToken,
    nextToken,
    previousToken,
    lastGeneratedTokenSignal,

    attentionTargetToken,
    attentionTargetHead,
    attentionVisibleRange,
    setAttentionTargetToken,
    setAttentionTargetHead,
    updateAttentionTargetToken,

    hasGeneration: computed(() => currentGenerationSignal.value.length > 0),

    attnLayer: signal<number | undefined>(undefined),
    maxTokens: signal<number>(200),
    paused: signal<boolean>(false),
    isGenerating: signal<boolean>(false),
    generationAbort: signal<AbortController>(),

    colorVerbosity: signal<"verbose" | "normal" | "none">("normal"),
    specialTokenFilter: signal<boolean>(true),
    showLineInfo: signal<boolean>(false),

    fimStartToken,
    fimEndToken,
    clearFimState,
    setFimStartToken,
    setFimEndToken,
    updateFimIndices,
};
