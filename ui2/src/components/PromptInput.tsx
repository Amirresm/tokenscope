import React from "react";
import DynamicTextarea from "./DynamicTextarea";
import generationStore from "../store/generationStore";
import sessionStore from "../store/sessionStore";
import { continueGeneration, generateNew } from "../api/generationAPI";
import drawerStore, { DrawerTabsEnum } from "../store/components/drawerStore";
import { GearIcon, RobotIcon } from "@phosphor-icons/react";
import { useCurrentModelQuery } from "../hooks/current-model-query";
import { GenerationSettingsDropdown } from "./GenerationSettingsDropdown";

export function PromptInput() {
    const sessionId = sessionStore.sessionId.value;
    const branchId = sessionStore.branchId.value;

    const presetPrompt = generationStore.presetPrompt.value;

    const [value, setValue] = React.useState(presetPrompt || "");

    const isGenerating = generationStore.isGenerating.value;
    const isPaused = generationStore.paused.value;

    const lastTokenIndex = generationStore.lastGeneratedToken.value?.position;
    const hasGeneration = generationStore.hasGeneration.value;
    const currentGeneration = generationStore.currentGeneration.value;

    const currentModelQuery = useCurrentModelQuery();
    const modelName = currentModelQuery.data?.modelName || "No Model Loaded";

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

        generationStore.presetPrompt.value = undefined;
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
                generationStore.generationSettings.value,
                true,
                generationStore.appendToGeneration,
                undefined,
                generationStore.generationAbort.value,
            );
        } else {
            generationStore.selectedToken.value = undefined;
            generationStore.generationAbort.value = new AbortController();
            drawerStore.setDrawerTab(DrawerTabsEnum.STATS);
            drawerStore.openDrawer();
            await generateNew(
                value,
                generationStore.generationSettings.value,
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
            <div className="fixed top-1/12 left-0 right-0 flex justify-center mt-8">
                <h1 className="text-logo">TokenScope</h1>
            </div>
            <div className="flex gap-2 mb-1 items-center">
                <button
                    className="btn btn-ghost"
                    onClick={() => {
                        const modal = document.getElementById(
                            "llm_management_modal",
                        ) as HTMLDialogElement;
                        modal.showModal();
                    }}
                >
                    <RobotIcon />
                    {modelName}
                </button>
            </div>
            <DynamicTextarea
                value={value}
                onChange={handleChange}
                disabled={isPaused}
                collapsed={hasGeneration}
            />
            <div className="flex gap-2 mt-4 items-center">
                <div className="grow" />
                <div className="dropdown dropdown-top">
                    <button
                        className="btn"
                        popoverTarget="popover-1"
                        style={{
                            anchorName: "--anchor-1",
                        }}
                    >
                        <GearIcon />
                    </button>
                    <GenerationSettingsDropdown />
                </div>
                {/* <label className="input w-40"> */}
                {/*     <span className="text-gray-500">Attention Layer</span> */}
                {/*     <input */}
                {/*         type="number" */}
                {/*         value={generationStore.attnLayer.value} */}
                {/*         onChange={(e) => { */}
                {/*             if (e.target.value === "") { */}
                {/*                 generationStore.attnLayer.value = undefined; */}
                {/*             } else { */}
                {/*                 generationStore.attnLayer.value = parseInt( */}
                {/*                     e.target.value, */}
                {/*                 ); */}
                {/*             } */}
                {/*         }} */}
                {/*     /> */}
                {/* </label> */}
                <label className="input w-40">
                    <span className="text-gray-500">Max Tokens</span>
                    <input
                        type="number"
                        min={0}
                        value={
                            generationStore.generationSettings.value.maxTokens
                        }
                        onChange={(e) =>
                            generationStore.updateGenerationSettings({
                                maxTokens: parseInt(e.target.value),
                            })
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
