import React from "react";
import DynamicTextarea from "./DynamicTextarea";
import generationStore from "../store/generationStore";
import sessionStore from "../store/sessionStore";
import { continueGeneration, generateNew } from "../api/generationAPI";

export function PromptInput() {
    const sessionId = sessionStore.sessionId.value;
    const branchId = sessionStore.branchId.value;

    const [value, setValue] = React.useState("");

    const isGenerating = generationStore.isGenerating.value;
    const isPaused = generationStore.paused.value;

    const lastTokenIndex = generationStore.lastGeneratedToken.value?.position;
    const hasGeneration = generationStore.hasGeneration.value;
    const currentGeneration = generationStore.currentGeneration.value;

    const handleChange = React.useCallback((v: string) => {
        setValue(v);
    }, []);

    const handleSubmit = React.useCallback(async () => {
        // If generation is already in progress, pause
        if (isGenerating) {
            generationStore.generationAbort.value?.abort();
            generationStore.isGenerating.value = false;
            generationStore.paused.value = true;
            return;
        }

        generationStore.clearGeneration();
        generationStore.isGenerating.value = true;
        generationStore.paused.value = false;

        if (isPaused && lastTokenIndex !== undefined) {
            generationStore.generationAbort.value = new AbortController();
            await continueGeneration(
                sessionId,
                branchId,
                lastTokenIndex,
                undefined,
                generationStore.maxTokens.value,
                true,
                generationStore.attnLayer.value,
                generationStore.appendToGeneration,
                undefined,
                generationStore.generationAbort.value,
            );
        } else {
            generationStore.selectedToken.value = undefined;
            generationStore.generationAbort.value = new AbortController();
            await generateNew(
                value,
                generationStore.maxTokens.value,
                generationStore.attnLayer.value,
                generationStore.appendToGeneration,
                undefined,
                generationStore.generationAbort.value,
            );
        }

        generationStore.isGenerating.value = false;
    }, [
        currentGeneration,
        isGenerating,
        isPaused,
        lastTokenIndex,
        value,
        branchId,
        sessionId,
    ]);

    return (
        <div className="h-full sticky z-10 top-0 px-36 pt-4 backdrop-blur-lg flex flex-col justify-center">
            <div className="fixed inset-0 main-bg-gradient -z-10" />
            <DynamicTextarea
                value={value}
                onChange={handleChange}
                disabled={isPaused}
                collapsed={hasGeneration}
            />
            <div className="flex gap-2 mt-4 items-center">
                <div className="grow" />
                <label className="input w-40">
                    <span className="text-gray-500">Attention Layer</span>
                    <input
                        type="number"
                        value={generationStore.attnLayer.value}
                        onChange={(e) => {
                            if (e.target.value === "") {
                                generationStore.attnLayer.value = undefined;
                            } else {
                                generationStore.attnLayer.value = parseInt(
                                    e.target.value,
                                );
                            }
                        }}
                    />
                </label>
                <label className="input w-40">
                    <span className="text-gray-500">Max Tokens</span>
                    <input
                        type="number"
                        min={0}
                        value={generationStore.maxTokens.value}
                        onChange={(e) =>
                            (generationStore.maxTokens.value = parseInt(
                                e.target.value,
                            ))
                        }
                    />
                </label>
                <button className="btn btn-neutral" onClick={handleSubmit}>
                    {isGenerating ? "Pause" : isPaused ? "Resume" : "Generate"}
                </button>
            </div>
        </div>
    );
}
