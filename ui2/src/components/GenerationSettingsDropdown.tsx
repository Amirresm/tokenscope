import React from "react";
import generationStore from "../store/generationStore";
import { QuestionIcon } from "@phosphor-icons/react";

export function GenerationSettingsDropdown() {
    const generationSettings = generationStore.generationSettings.value;

    const handleSettingChange = React.useCallback(
        (key: keyof typeof generationSettings, value: unknown) => {
            generationStore.updateGenerationSettings({ [key]: value });
        },
        [],
    );

    return (
        <div
            className="dropdown bg-base-200 rounded-box z-1 py-4 px-2 shadow-sm w-96 overflow-x-hidden"
            popover="auto"
            id="popover-1"
            style={{ positionAnchor: "--anchor-1" }}
        >
            <div className="flex flex-col gap-2 text-sm">
                <h3 className="px-4 mb-4 font-semibold text-lg">
                    Token Level View Config
                </h3>
                <div className="flex justify-between items-center px-4">
                    <span className="text-base-content">Alternative Tokens</span>
                    <label className="input w-24">
                        <input
                            type="number"
                            value={generationSettings.alternatives}
                            onChange={(e) =>
                                handleSettingChange(
                                    "alternatives",
                                    e.target.value === ""
                                        ? undefined
                                        : parseInt(e.target.value),
                                )
                            }
                        />
                    </label>
                </div>
                <div className="flex justify-between items-center px-4">
                    <span className="text-base-content">Top K</span>
                    <label className="input w-24">
                        <input
                            type="number"
                            value={generationSettings.topK}
                            onChange={(e) =>
                                handleSettingChange(
                                    "topK",
                                    e.target.value === ""
                                        ? undefined
                                        : parseInt(e.target.value),
                                )
                            }
                        />
                    </label>
                </div>
                <div className="flex justify-between items-center px-4">
                    <span className="text-base-content">Top P</span>
                    <label className="input w-24">
                        <input
                            type="number"
                            step="0.01"
                            value={generationSettings.topP}
                            onChange={(e) =>
                                handleSettingChange("topP", e.target.value)
                            }
                        />
                    </label>
                </div>
                <div className="flex justify-between items-center px-4">
                    <span className="text-base-content">Temperature</span>
                    <label className="input w-24">
                        <input
                            type="number"
                            step="0.01"
                            value={generationSettings.temp}
                            onChange={(e) =>
                                handleSettingChange("temp", e.target.value)
                            }
                        />
                    </label>
                </div>
                <div className="flex justify-between items-center px-4">
                    <span className="text-base-content flex items-center gap-1">
                        Attention Layer
                        <div
                            className="tooltip tooltip-top before:w-64"
                            data-tip="The layer number to visualize attention from. Use -1 for the last layer."
                        >
                            <QuestionIcon size={16} />
                        </div>
                    </span>
                    <label className="input w-24">
                        <input
                            type="number"
                            value={generationSettings.attentionLayer}
                            onChange={(e) =>
                                handleSettingChange(
                                    "attentionLayer",
                                    e.target.value === ""
                                        ? undefined
                                        : parseInt(e.target.value),
                                )
                            }
                        />
                    </label>
                </div>
                <div className="flex justify-between items-center px-4">
                    <span className="text-base-content">Attention Top N</span>
                    <label className="input w-24">
                        <input
                            type="number"
                            value={generationSettings.attentionTopN}
                            onChange={(e) =>
                                handleSettingChange(
                                    "attentionTopN",
                                    e.target.value === ""
                                        ? undefined
                                        : parseInt(e.target.value),
                                )
                            }
                        />
                    </label>
                </div>
            </div>
        </div>
    );
}
