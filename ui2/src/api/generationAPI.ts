import generationStore, { GenerationToken } from "../store/generationStore";

const serializeGenerationToken = (data: GenerationToken, index: number) => {
    return {
        index: index,
        token: data.token,
        token_id: data.tokenId,
        confidence: data.confidence,
        all_tokens_ids: data.allTokensIds,
        all_tokens: data.allTokens,
        all_confidences: data.allConfidences,
        tags: data.tags,
        stop: data.stop || data.tags.includes("stop"),
        prompt: data.prompt || data.tags.includes("prompt"),
        manual: data.manual || data.tags.includes("manual"),
        attention_snapshot: data.attentionSnapshot,
    };
};

const handleStream = async (
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
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        const textList = decoder.decode(value).split("\n");
        textList.forEach((text) => {
            if (text === "") {
                return;
            }
            let data;
            try {
                data = JSON.parse(text);
            } catch (error) {
                console.log("Error:", error);
                console.log("Text:", text);
                return;
            }

            const attentionSnapshot = data.attention_snapshot
                ? data.attention_snapshot.map((snapshot: [number, string][]) =>
                      snapshot.map((value) => ({
                          index: value[0],
                          attention: parseFloat(value[1]),
                      })),
                  )
                : undefined;

            handleData({
                index: data.index,
                token: data.token,
                tokenId: data.token_id,
                confidence: data.confidence,
                allTokensIds: data.all_tokens_ids,
                allTokens: data.all_tokens,
                allConfidences: data.all_confidences,
                tags: data.tags,
                stop: data.stop || data.tags.includes("stop"),
                prompt: data.prompt || data.tags.includes("prompt"),
                manual: data.manual || data.tags.includes("manual"),
                attentionSnapshot,
            });
        });
    }
    reader.releaseLock();
    onComplete?.();
    if (generationStore.attentionTargetToken.value) {
        generationStore.updateAttentionTargetToken(
            generationStore.attentionTargetHead.value,
            generationStore.attentionTargetToken.value,
        );
    }
    console.log("Stream finished");
    return;
};

const generate = async ({
    prompt,
    maxTokens,
    attnLayer,
    handleData,
    onComplete,
    abortSignal,
}: {
    prompt: string;
    maxTokens?: number;
    attnLayer?: number;
    handleData: (data: GenerationToken) => void;
    onComplete?: () => void;
    abortSignal?: AbortController;
}) => {
    try {
        const response = await fetch("http://10.0.0.92:3000/api/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: prompt,
                max_tokens: maxTokens || 200,
                attn_layer: attnLayer ?? null,
                use_gen_batch: true,
            }),
            signal: abortSignal?.signal,
        });
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        await handleStream(response, handleData, onComplete);
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            console.log("Generation aborted");
            return;
        }
        console.error("Error:", error);
    }
};

const continueGeneration = async ({
    base,
    subIndex,
    subTokens,
    maxTokens,
    attnLayer,
    handleData,
    onComplete,
    abortSignal,
}: {
    base: GenerationToken[];
    subIndex: number;
    subTokens?: string;
    maxTokens?: number;
    attnLayer?: number;
    handleData: (data: GenerationToken) => void;
    onComplete?: () => void;
    abortSignal?: AbortController;
}) => {
    try {
        const baseGeneration = base
            .filter((token) => !token.tags.includes("special"))
            .map(serializeGenerationToken);
        const response = await fetch("http://10.0.0.92:3000/api/continue", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                base: baseGeneration,
                index: subIndex,
                forced_token: subTokens,
                max_tokens: maxTokens || 200,
                attn_layer: attnLayer ?? null,
            }),
            signal: abortSignal?.signal,
        });
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        await handleStream(response, handleData, onComplete);
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            console.log("Generation aborted");
            return;
        }
        console.error("Error:", error);
    }
};

const fim = async ({
    base,
    startIndex,
    endIndex,
    replaceTokens,
    maxTokens,
    attnLayer,
    handleData,
    onComplete,
    abortSignal,
}: {
    base: GenerationToken[];
    startIndex: number;
    endIndex: number;
    replaceTokens: string;
    maxTokens?: number;
    attnLayer?: number;
    handleData: (data: GenerationToken) => void;
    onComplete?: () => void;
    abortSignal?: AbortController;
}) => {
    try {
        // adjust indices
        const numberOfSpecialTokensBefore = base.filter(
            (token) =>
                token.tags.includes("special") && token.index < startIndex,
        ).length;
        const numberOfSpecialTokensAfter = base.filter(
            (token) => token.tags.includes("special") && token.index < endIndex,
        ).length;

        const baseGeneration = base
            .filter((token) => !token.tags.includes("special"))
            .map(serializeGenerationToken);

        const response = await fetch("http://10.0.0.92:3000/api/fim", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                base: baseGeneration,
                start_index: startIndex - numberOfSpecialTokensBefore,
                end_index: endIndex - numberOfSpecialTokensAfter,
                replace_tokens: replaceTokens,
                max_tokens: maxTokens || 200,
                attn_layer: attnLayer ?? null,
            }),
            signal: abortSignal?.signal,
        });
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        await handleStream(response, handleData, onComplete);
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            console.log("Generation aborted");
            return;
        }
        console.error("Error:", error);
    }
};

export default {
    generate,
    continueGeneration,
    fim,
};
