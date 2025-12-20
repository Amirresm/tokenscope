import React from "react";
import DynamicTextarea from "./DynamicTextarea";
import generationStore from "../store/generationStore";
import { PaintBucketIcon } from "@phosphor-icons/react";
import sessionStore from "../store/sessionStore";
import globalStore from "../store/components/globalStore";
import { continueGeneration, generateNew } from "../api/generationAPI";
import tokenLevelViewStore, {
    ColorVerbosityEnum,
} from "../store/components/tokenLevelViewStore";

export function PromptInput() {
    const sessionId = sessionStore.sessionId.value;
    const branchId = sessionStore.branchId.value;

    const viewMode = globalStore.viewMode.value;

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

    const handleReset = React.useCallback(() => {
        // setValue("");
        generationStore.clearGeneration();
        generationStore.isGenerating.value = false;
        generationStore.paused.value = false;
        if (generationStore.generationAbort.value) {
            generationStore.generationAbort.value.abort();
        }
    }, []);

    const handleToggleViewMode = React.useCallback(() => {
        globalStore.viewMode.value =
            viewMode === "generation" ? "graph" : "generation";
    }, [viewMode]);

    const colorVerbosityOptions = Object.values(ColorVerbosityEnum);

    return (
        <div className="sticky z-10 top-0 px-4 pt-4 bg-base-100/50 backdrop-blur-lg">
            <DynamicTextarea
                value={value}
                onChange={handleChange}
                disabled={isPaused}
                collapsed={hasGeneration}
            />
            <div className="flex gap-2 mt-4 items-center">
                <div className="dropdown">
                    <div tabIndex={0} role="button" className="btn m-1">
                        <PaintBucketIcon />
                    </div>
                    <ul
                        tabIndex={0}
                        className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
                    >
                        {colorVerbosityOptions.map((option) => (
                            <li
                                key={option}
                                onClick={() =>
                                    (tokenLevelViewStore.colorVerbosity.value =
                                        option)
                                }
                            >
                                <a>{option}</a>
                            </li>
                        ))}
                    </ul>
                </div>
                <button
                    className="btn btn-ghost"
                    onClick={handleToggleViewMode}
                >
                    {viewMode === "generation"
                        ? "Generation View"
                        : "Graph View"}
                </button>
                <button
                    className={`btn btn-ghost ${
                        !tokenLevelViewStore.specialTokenFilter.value
                            ? "btn-active"
                            : ""
                    }`}
                    onClick={() => {
                        tokenLevelViewStore.specialTokenFilter.value =
                            !tokenLevelViewStore.specialTokenFilter.value;
                    }}
                >
                    Show Special
                </button>
                <button
                    className={`btn btn-ghost ${
                        tokenLevelViewStore.showLineInfo.value
                            ? "btn-active"
                            : ""
                    }`}
                    onClick={() => {
                        tokenLevelViewStore.showLineInfo.value =
                            !tokenLevelViewStore.showLineInfo.value;
                    }}
                >
                    Show Line Info
                </button>
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
                <button className="btn" onClick={handleReset}>
                    Reset
                </button>
                <button className="btn btn-neutral" onClick={handleSubmit}>
                    {isGenerating ? "Pause" : isPaused ? "Resume" : "Generate"}
                </button>
            </div>
        </div>
    );
}
