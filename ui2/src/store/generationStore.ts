import { signal } from "@preact/signals-react";

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

const generationStateSignal = signal<GenerationToken[]>([]);

function clearGeneration() {
    generationStateSignal.value = [];
}

function appendToGeneration(token: GenerationToken) {
    generationStateSignal.value = [...generationStateSignal.value, token];
}

export default {
	generationStateSignal,
	clearGeneration,
	appendToGeneration,
}
