import { computed, signal } from "@preact/signals-react";
import {
    GenerationToken,
    getGenerationTokenSortBias,
} from "../models/generationToken";

const currentGeneration = signal<GenerationToken[]>([]);
const hasGeneration = computed(() => currentGeneration.value.length > 0);

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

const setAttentionTargetHead = (head: number) => {
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

export default {
    currentGeneration,
    clearGeneration,
    appendToGeneration,

    selectedToken,
    nextToken,
    previousToken,
    lastGeneratedToken,

    attentionTargetToken,
    attentionTargetHead,
    attentionVisibleRange,
    setAttentionTargetToken,
    setAttentionTargetHead,
    updateAttentionTargetToken,

    hasGeneration,

    attnLayer: signal<number | undefined>(undefined),
    maxTokens: signal<number>(200),
    paused: signal<boolean>(false),
    isGenerating: signal<boolean>(false),
    generationAbort: signal<AbortController>(),

    fimStartToken,
    fimEndToken,
    clearFimState,
    setFimStartToken,
    setFimEndToken,
    updateFimIndices,
};
