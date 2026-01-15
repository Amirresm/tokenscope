import {
    GenerationToken,
    GenerationTokenData,
    generationTokenFromData,
} from "../models/generationToken";
import generationStore from "../store/generationStore";
import sessionStore from "../store/sessionStore";
import { calcPercentile } from "../utils/calcPercentile";
import { API_BASE_URL } from "./constants";

type TokenGenerationData =
    | {
          type: "token";
          content: GenerationTokenData;
      }
    | {
          type: "session_info";
          content: { session_id: string; branch_id: string };
      };

const handleTokenGenerationStream = async (
    response: Response,
    handleData: (data: GenerationToken) => void,
    onComplete?: () => void,
) => {
    if (!response.body) {
        console.error("No body in response");
        return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        let newLineIndex;

        while ((newLineIndex = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, newLineIndex);
            buffer = buffer.slice(newLineIndex + 1);
            if (line === "") {
                continue;
            }

            let data: TokenGenerationData;
            try {
                data = JSON.parse(line);
                if (data.type === "session_info") {
                    sessionStore.branchId.value = data.content.branch_id;
                    sessionStore.sessionId.value = data.content.session_id;
                } else if (data.type === "token") {
                    handleData(generationTokenFromData(data.content));
                    if (
                        sessionStore.branchId.value !== data.content.branch_id
                    ) {
                        sessionStore.branchId.value = data.content.branch_id;
                    }
                } else {
                    console.warn(
                        "Unknown data type received at generation stream:",
                        data,
                    );
                }
            } catch (error) {
                console.log("Error:", error);
                console.log("Line:", line);
                return;
            }
        }
    }
    reader.releaseLock();
    onComplete?.();
    if (generationStore.attentionTargetToken.value) {
        generationStore.updateAttentionTargetToken(
            generationStore.attentionTargetHead.value,
            generationStore.attentionTargetToken.value,
        );
    }

    // get min max for metrics
    const confidenceDomain = [Infinity, -Infinity];
    const perplexityDomain = [Infinity, -Infinity];
    const lastPerplexityDomain = [Infinity, -Infinity];
    const stdevDomain = [Infinity, -Infinity];

    for (const token of generationStore.currentGeneration.value) {
        if (token.confidence !== undefined && token.confidence >= 0) {
            confidenceDomain[0] = Math.min(
                confidenceDomain[0],
                token.confidence,
            );
            confidenceDomain[1] = Math.max(
                confidenceDomain[1],
                token.confidence,
            );
        }
        if (token.perplexity !== undefined && !isNaN(token.perplexity)) {
            perplexityDomain[0] = Math.min(
                perplexityDomain[0],
                token.perplexity,
            );
            perplexityDomain[1] = Math.max(
                perplexityDomain[1],
                token.perplexity,
            );
        }
        if (
            token.lastPerplexity !== undefined &&
            !isNaN(token.lastPerplexity)
        ) {
            lastPerplexityDomain[0] = Math.min(
                lastPerplexityDomain[0],
                token.lastPerplexity,
            );
            lastPerplexityDomain[1] = Math.max(
                lastPerplexityDomain[1],
                token.lastPerplexity,
            );
        }
        if (token.std !== undefined) {
            stdevDomain[0] = Math.min(stdevDomain[0], token.std);
            stdevDomain[1] = Math.max(stdevDomain[1], token.std);
        }
    }

    // get percentiles for metrics
    const confidencePercentiles: number[] = [];
    const perplexityPercentiles: number[] = [];
    const lastPerplexityPercentiles: number[] = [];
    const stdevPercentiles: number[] = [];

    for (let p = 0; p < 100; p += 20) {
        const confPerc = calcPercentile(
            generationStore.currentGeneration.value.filter(
                (t) => !t.prompt && !t.manual,
            ),
            (t) => (t.confidence !== undefined ? t.confidence : 0),
            p,
        );
        if (confPerc !== null) {
            confidencePercentiles.push(confPerc);
        }
        const perpPerc = calcPercentile(
            generationStore.currentGeneration.value,
            (t) => (t.perplexity !== undefined ? t.perplexity : Infinity),
            p,
        );
        if (perpPerc !== null) {
            perplexityPercentiles.push(perpPerc);
        }
        const lastPerpPerc = calcPercentile(
            generationStore.currentGeneration.value,
            (t) =>
                t.lastPerplexity !== undefined ? t.lastPerplexity : Infinity,
            p,
        );
        if (lastPerpPerc !== null) {
            lastPerplexityPercentiles.push(lastPerpPerc);
        }
        const stdPerc = calcPercentile(
            generationStore.currentGeneration.value.filter(
                (t) => !t.prompt && !t.manual,
            ),
            (t) => (t.std !== undefined ? t.std : 0),
            p,
        );
        if (stdPerc !== null) {
            stdevPercentiles.push(stdPerc);
        }
    }
    generationStore.confidenceTenPercentiles.value = confidencePercentiles;
    generationStore.perplexityTenPercentiles.value = perplexityPercentiles;
    generationStore.lastPerplexityTenPercentiles.value =
        lastPerplexityPercentiles;
    generationStore.stdevTenPercentiles.value = stdevPercentiles;

    generationStore.confidenceDomain.value = [
        confidenceDomain[0],
        confidenceDomain[1],
    ];
    generationStore.perplexityDomain.value = [
        perplexityDomain[0],
        perplexityDomain[1],
    ];
    generationStore.lastPerplexityDomain.value = [
        lastPerplexityDomain[0],
        lastPerplexityDomain[1],
    ];
    generationStore.stdevDomain.value = [stdevDomain[0], stdevDomain[1]];

    console.log("Stream finished");
    return;
};

export async function generateNew(
    prompt: string,
    maxTokens: number = 200,
    attnLayer: number | null = null,
    handleData: (data: GenerationToken) => void,
    onComplete?: () => void,
    abortSignal?: AbortController,
) {
    try {
        const response = await fetch(`${API_BASE_URL}/generate_new`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: prompt,
                max_tokens: maxTokens,
                attn_layer: attnLayer,
            }),
            signal: abortSignal?.signal,
        });
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        await handleTokenGenerationStream(response, handleData, onComplete);
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            console.log("Generation aborted");
            return;
        }
        console.error("Error:", error);
    }
}

export async function prefillGeneration(
    sessionId: string,
    branchId: string,
    handleData: (data: GenerationToken) => void,
    onComplete?: () => void,
    abortSignal?: AbortController,
) {
    try {
        const response = await fetch(`${API_BASE_URL}/prefill_generation`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                session_id: sessionId,
                branch_id: branchId,
            }),
            signal: abortSignal?.signal,
        });
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        await handleTokenGenerationStream(response, handleData, onComplete);
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            console.log("Generation aborted");
            return;
        }
        console.error("Error:", error);
    }
}

export async function continueGeneration(
    sessionId: string,
    branchId: string,
    branchPosition: number,
    appendedPrompt: string = "",
    maxTokens: number = 200,
    resumeOldBranch: boolean = false,
    attnLayer: number | null = null,
    handleData: (data: GenerationToken) => void,
    onComplete?: () => void,
    abortSignal?: AbortController,
) {
    try {
        const response = await fetch(`${API_BASE_URL}/continue`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                session_id: sessionId,
                branch_id: branchId,
                branch_position: branchPosition,
                appended_prompt: appendedPrompt,
                max_tokens: maxTokens,
                resume_old_branch: resumeOldBranch,
                attn_layer: attnLayer,
            }),
            signal: abortSignal?.signal,
        });
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        await handleTokenGenerationStream(response, handleData, onComplete);
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            console.log("Generation aborted");
            return;
        }
        console.error("Error:", error);
    }
}
