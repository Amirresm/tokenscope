import { computed, signal } from "@preact/signals-react";

export type GenerationToken = {
    token: string;
    index: number;
    allTokens: string[];
    allConfidences: number[];
    confidence: number;
    stop: boolean;
    prompt: boolean;
    manual: boolean;
};

const currentGenerationSignal = signal<GenerationToken[]>([]);

const lastGeneratedTokenSignal = computed(() => {
    const generation = currentGenerationSignal.value;
    if (generation.length === 0) return null;
    return generation[generation.length - 1];
});

function clearGeneration() {
    currentGenerationSignal.value = [];
}

function appendToGeneration(token: GenerationToken) {
    currentGenerationSignal.value = [...currentGenerationSignal.value, token];
}

const activeGenerationSignal = signal<GenerationToken | null>(null);

function setActiveGeneration(token: GenerationToken | null) {
    activeGenerationSignal.value = token;
}

export default {
    currentGenerationSignal,
	lastGeneratedTokenSignal,
    activeGenerationSignal,
    clearGeneration,
    appendToGeneration,
    setActiveGeneration,
};
