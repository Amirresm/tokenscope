import { computed, signal } from "@preact/signals-react";

export type GenerationToken = {
    index: number;
    token: string;
    tokenId: number;
    confidence: number;
    allTokensIds: number[];
    allTokens: string[];
    allConfidences: number[];
    tags: string[];
    stop?: boolean;
    prompt?: boolean;
    manual?: boolean;
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
    currentGenerationSignal.value = newGeneration;
}

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
}

export default {
    currentGenerationSignal,
    clearGeneration,
    appendToGeneration,

    selectedToken,
    nextToken,
    previousToken,
    lastGeneratedTokenSignal,

    hasGeneration: computed(() => currentGenerationSignal.value.length > 0),

    maxTokens: signal<number>(200),
    paused: signal<boolean>(false),
    isGenerating: signal<boolean>(false),
    generationAbort: signal<AbortController>(),

    colorVerbosity: signal<"verbose" | "normal" | "none">("normal"),
    specialTokenFilter: signal<boolean>(false),

    fimStartToken,
    fimEndToken,
    clearFimState,
    setFimStartToken,
    setFimEndToken,
	updateFimIndices,
};
