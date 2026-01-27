import {
    GenerationToken,
    GenerationTokenData,
    generationTokenFromData,
} from "../models/generationToken";
import generationStore, { GenerationSettings } from "../store/generationStore";
import sessionStore from "../store/sessionStore";
import { calcAllPercentiles, calcPercentile } from "../utils/calcPercentile";
import { clampOutliers } from "../utils/outlier";
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

function linearBuckets(
    min: number,
    max: number,
    numBuckets: number,
): number[] {
    if (numBuckets <= 0) {
        throw new Error("numBuckets must be > 0");
    }
    if (min >= max) {
        throw new Error("min must be < max");
    }

    const step = (max - min) / numBuckets;

    const buckets: number[] = [];
    for (let i = 0; i < numBuckets; i++) {
        buckets.push(min + i * step);
    }

    return buckets;
}

function logBuckets(
    min: number,
    max: number,
    numBuckets: number,
    linScale = 1,
): number[] {
    if (numBuckets <= 0) {
        throw new Error("numBuckets must be > 0");
    }
    if (min >= max) {
        throw new Error("min must be < max");
    }

    const symlog = (x: number): number =>
        Math.sign(x) * Math.log1p(Math.abs(x) / linScale);

    const symexp = (y: number): number =>
        Math.sign(y) * linScale * Math.expm1(Math.abs(y));

    const sMin = symlog(min);
    const sMax = symlog(max);

    const step = (sMax - sMin) / numBuckets;

    const buckets: number[] = [];
    for (let i = 0; i < numBuckets; i++) {
        buckets.push(symexp(sMin + i * step));
    }

    return buckets;
}

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
    console.log("Calculating Context-Aware NLLs...");

    // const contextSize = 10;
    // const contextAwareNLLs = [];
    // for (const token of generationStore.currentGeneration.value) {
    //     console.log("Token:", token.position, token.lastPerplexity);
    //     if (token.lastPerplexity === undefined) {
    //         throw new Error("Token missing lastPerplexity");
    //     }
    //     let startPos = Math.max(0, token.position - contextSize);
    //     let endPos = token.position;
    //     if (endPos <= 0) {
    //         contextAwareNLLs.push(token.lastPerplexity);
    //         continue;
    //     }
    //     let contextProbs = generationStore.currentGeneration.value
    //         .slice(startPos, endPos)
    //         .map((t) => Math.exp(-t.lastPerplexity!));
    //     let avg =
    //         contextProbs.reduce((a, b) => a + b, 0) / contextProbs.length;
    //     avg = -Math.log(avg);
    //     contextAwareNLLs.push(token.lastPerplexity - avg);
    // }
    // // generationStore.currentGeneration.value[0].lastPerplexity = 0;
    // for (let i = 0; i < generationStore.currentGeneration.value.length; i++) {
    //     generationStore.currentGeneration.value[i].lastPerplexity =
    //         contextAwareNLLs[i];
    // }

    // attention saliency
    const attentionHeads =
        generationStore.currentGeneration.value.length > 0
            ? Object.keys(
                  generationStore.currentGeneration.value[
                      generationStore.currentGeneration.value.length - 1
                  ].attentionSnapshot || {},
              )
            : [];
    if (attentionHeads.length > 0) {
        for (const head of attentionHeads) {
            for (const token of generationStore.currentGeneration.value) {
                if (token.reverseAttentionSnapshot === undefined) {
                    token.reverseAttentionSnapshot = {};
                }
                token.reverseAttentionSnapshot[head] = [];
                for (const otherToken of generationStore.currentGeneration
                    .value) {
                    if (token.position > otherToken.position) {
                        continue;
                    }
                    if (otherToken.attentionSnapshot) {
                        for (const attnInfo of otherToken.attentionSnapshot[
                            head
                        ]) {
                            if (attnInfo.index === token.position) {
                                token.reverseAttentionSnapshot[head].push({
                                    index: otherToken.position,
                                    attention: attnInfo.attention,
                                });
                            }
                        }
                    }
                }
                token.reverseAttentionSnapshot[head].sort(
                    (a, b) => b.attention - a.attention,
                );
            }
        }
    }

    // //TEMP
    // for (const token of generationStore.currentGeneration.value) {
    //     if (token.marginConfidence !== undefined) {
    //         token.marginConfidence = token.confidence - token.marginConfidence;
    //     }
    // }

    // redo attention saliency
    for (const head of attentionHeads) {
        for (const token of generationStore.currentGeneration.value) {
            token.attentionSaliences[head] = 0;
            if (
                token.reverseAttentionSnapshot &&
                token.reverseAttentionSnapshot[head]
            ) {
                const totalAttention = token.reverseAttentionSnapshot[
                    head
                ].reduce((sum, attnInfo) => sum + attnInfo.attention, 0);
                const numContributions =
                    token.reverseAttentionSnapshot[head].length;
                if (numContributions > 0) {
                    token.attentionSaliences[head] =
                        totalAttention / numContributions;
                }
            }
        }
        const attentionSaliencyValues = clampOutliers(
            generationStore.currentGeneration.value
                .filter((t) => t.attentionSaliences[head] !== undefined)
                .map((t) =>
                    t.attentionSaliences[head] !== undefined
                        ? t.attentionSaliences[head]
                        : 0,
                ),
            0,
        );
        const numBuckets = 5;
        const attentionSaliencyPercentiles = calcAllPercentiles(
            attentionSaliencyValues,
            numBuckets,
        );
        generationStore.attentionSaliencyTenPercentiles.value[head] =
            attentionSaliencyPercentiles;
    }

    console.log("Calculating Percentiles...");
    // get min max for metrics
    const confidenceDomain = [Infinity, -Infinity];
    const perplexityDomain = [Infinity, -Infinity];
    const lastPerplexityDomain = [Infinity, -Infinity];

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
    }

    // get percentiles for metrics

    const confValues = clampOutliers(
        generationStore.currentGeneration.value
            .filter((t) => t.confidence !== undefined && !t.prompt && !t.manual)
            .map((t) => (t.confidence !== undefined ? t.confidence : 0)),
        0,
    );
    const perpValues = clampOutliers(
        generationStore.currentGeneration.value.map((t) =>
            t.perplexity !== undefined ? t.perplexity : Infinity,
        ),
        0.01,
    );
    const lastPerpValues = clampOutliers(
        generationStore.currentGeneration.value.map((t) =>
            t.lastPerplexity !== undefined ? t.lastPerplexity : Infinity,
        ),
        0.01,
    );
    const marginConfValues = clampOutliers(
        generationStore.currentGeneration.value
            .filter(
                (t) =>
                    t.marginConfidence !== undefined && !t.prompt && !t.manual,
            )
            .map((t) =>
                t.marginConfidence !== undefined ? t.marginConfidence : 0,
            ),
        0,
    );
    const entropyValues = clampOutliers(
        generationStore.currentGeneration.value
            .filter((t) => t.entropy !== undefined && !t.prompt && !t.manual)
            .map((t) => (t.entropy !== undefined ? t.entropy : 0)),
        0,
    );
    const numBuckets = 5;
    const confidencePercentiles = calcAllPercentiles(confValues, numBuckets);
    const marginConfidencePercentiles = calcAllPercentiles(
        marginConfValues,
        numBuckets,
    );
    const entropyPercentiles = calcAllPercentiles(entropyValues, numBuckets);
    const perplexityPercentiles = calcAllPercentiles(perpValues, numBuckets);
    const lastPerplexityPercentiles = calcAllPercentiles(
        lastPerpValues,
        numBuckets,
    );
    generationStore.confidenceTenPercentiles.value = confidencePercentiles;
    generationStore.perplexityTenPercentiles.value = perplexityPercentiles;
    generationStore.lastPerplexityTenPercentiles.value =
        lastPerplexityPercentiles;
    // generationStore.lastPerplexityTenPercentiles.value = logBuckets(
    //     Math.min(...lastPerpValues),
    //     Math.max(...lastPerpValues),
    //     5,
    // );
    generationStore.marginConfidenceTenPercentiles.value =
        marginConfidencePercentiles;
    generationStore.entropyTenPercentiles.value = entropyPercentiles;

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
    console.log("Stream finished");
    return;
};

export async function generateNew(
    prompt: string,
    generationSettings: GenerationSettings,
    handleData: (data: GenerationToken) => void,
    onComplete?: () => void,
    abortSignal?: AbortController,
) {
    const temp = parseFloat(generationSettings.temp);
    let coeff = 1;
    if (isNaN(temp)) {
        coeff = 1;
    } else if (temp <= 0) {
        coeff = 9999999;
    } else {
        coeff = 1 / temp;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/generate_new`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: prompt,
                max_tokens: generationSettings.maxTokens,
                topk: generationSettings.topK,
                topp: parseFloat(generationSettings.topP),
                coeff: coeff,
                alternatives: generationSettings.alternatives,
                attention_layer: generationSettings.attentionLayer,
                attention_top_n: generationSettings.attentionTopN,
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
    generationSettings: GenerationSettings,
    resumeOldBranch: boolean = false,
    handleData: (data: GenerationToken) => void,
    onComplete?: () => void,
    abortSignal?: AbortController,
) {
    try {
        const temp = parseFloat(generationSettings.temp);
        let coeff = 1;
        if (isNaN(temp)) {
            coeff = 1;
        } else if (temp <= 0) {
            coeff = 9999999;
        } else {
            coeff = 1 / temp;
        }
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
                max_tokens: generationSettings.maxTokens,
                topk: generationSettings.topK,
                topp: parseFloat(generationSettings.topP),
                coeff: coeff,
                alternatives: generationSettings.alternatives,
                attention_layer: generationSettings.attentionLayer,
                attention_top_n: generationSettings.attentionTopN,
                resume_old_branch: resumeOldBranch,
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
