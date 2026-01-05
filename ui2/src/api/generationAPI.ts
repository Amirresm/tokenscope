import {
    GenerationToken,
    GenerationTokenData,
    generationTokenFromData,
} from "../models/generationToken";
import generationStore from "../store/generationStore";
import sessionStore from "../store/sessionStore";
import { API_BASE_URL } from "./constants";

type TojenGenerationData =
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
            let data: TojenGenerationData;
            try {
                data = JSON.parse(text);
            } catch (error) {
                console.log("Error:", error);
                console.log("Text:", text);
                return;
            }

            if (data.type === "session_info") {
                sessionStore.branchId.value = data.content.branch_id;
                sessionStore.sessionId.value = data.content.session_id;
            } else if (data.type === "token") {
                handleData(generationTokenFromData(data.content));
                if (sessionStore.branchId.value !== data.content.branch_id) {
                    sessionStore.branchId.value = data.content.branch_id;
                }
            } else {
                console.warn(
                    "Unknown data type received at generation stream:",
                    data,
                );
            }
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
