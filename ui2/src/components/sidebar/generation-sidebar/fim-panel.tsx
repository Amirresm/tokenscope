import React from "react";
import generationStore from "../../../store/generationStore";
import generationAPI from "../../../api/generationAPI";

export default function FimPanel() {
    const [replaceToken, setReplaceToken] = React.useState<string>("");

    const currentGeneration = generationStore.currentGenerationSignal.value;
    const fimStartToken = generationStore.fimStartToken.value;
    const fimEndToken = generationStore.fimEndToken.value;

    const handleClick = React.useCallback(() => {
        generationStore.clearFimState();
    }, []);

    const handleFillInTheMiddle = React.useCallback(async () => {
        if (generationStore.generationAbort.value) {
            generationStore.generationAbort.value.abort();
        }

        generationStore.clearGeneration();
        generationStore.clearFimState();
		generationStore.selectedToken.value = undefined;

        if (!fimStartToken) {
            console.error("Fill In The Middle: Start or End token is missing");
            return;
        }

        generationStore.isGenerating.value = true;
        generationStore.paused.value = false;

        generationStore.generationAbort.value = new AbortController();

        await generationAPI.fim({
            base: currentGeneration,
            startIndex: fimStartToken,
            endIndex: fimEndToken || fimStartToken,
            replaceTokens: replaceToken,
            maxTokens: generationStore.maxTokens.value,
            abortSignal: generationStore.generationAbort.value,
            handleData: generationStore.appendToGeneration,
        });

        generationStore.isGenerating.value = false;
    }, [currentGeneration, fimEndToken, fimStartToken, replaceToken]);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex">
                <button
                    className="btn btn-sm btn-ghost"
                    onClick={handleClick}
                    disabled={fimStartToken == null}
                >
                    Clear
                </button>
            </div>
            <textarea
                className="input"
                placeholder="Substitute string"
                value={replaceToken}
                onChange={(e) => setReplaceToken(e.target.value)}
            />
            <button
                className="btn btn-primary"
                onClick={handleFillInTheMiddle}
                disabled={generationStore.isGenerating.value || !fimStartToken}
            >
                Fill In The Middle
            </button>
        </div>
    );
}
