import React from "react";
import generationStore, {
    GenerationToken,
} from "../../../store/generationStore";
import "./generation-sidebar.css";
import generationAPI from "../../../api/generationAPI";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import AlternativeTokens from "./alternative-tokens";
import FimPanel from "./fim-panel";

type GenerationMode = "continue" | "fim";

const colorMap = {
    0: "text-red-300",
    0.25: "text-orange-300",
    0.5: "text-yellow-300",
    0.75: "text-green-300",
    0.98: "text-blue-300",
};

const getColor = (confidence: number) =>
    Object.entries(colorMap).reduce((acc, [threshold, color]) => {
        if (confidence >= parseFloat(threshold)) {
            return color;
        }
        return acc;
    }, "");

export function Content({ token }: { token: GenerationToken }) {
    const [substituteToken, setSubstituteToken] = React.useState("");
    const [generationMode, setGenerationMode] =
        React.useState<GenerationMode>("continue");

    const currentGeneration = generationStore.currentGenerationSignal.value;
    const nextToken = generationStore.nextToken.value;
    const prevToken = generationStore.previousToken.value;

    const handleNextToken = React.useCallback(() => {
        if (nextToken) {
            generationStore.selectedToken.value = nextToken;
        }
    }, [nextToken]);

    const handlePrevToken = React.useCallback(() => {
        if (prevToken) {
            generationStore.selectedToken.value = prevToken;
        }
    }, [prevToken]);

    const handleSubstituteTokenChange = React.useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setSubstituteToken(e.target.value);
        },
        [],
    );

    const handleSubstituteToken = React.useCallback(
        async (tokens: string) => {
            if (generationStore.generationAbort.value) {
                generationStore.generationAbort.value.abort();
            }

            generationStore.clearGeneration();

            generationStore.isGenerating.value = true;
            generationStore.paused.value = false;

            generationStore.generationAbort.value = new AbortController();

            await generationAPI.continueGeneration({
                base: currentGeneration,
                subIndex: token.index,
                subTokens: tokens,
                maxTokens: generationStore.maxTokens.value,
                abortSignal: generationStore.generationAbort.value,
                handleData: generationStore.appendToGeneration,
            });

            generationStore.isGenerating.value = false;
        },
        [currentGeneration, token.index],
    );

    // React.useEffect(() => {
    //     window.addEventListener("keydown", (e) => {
    //console.log(e.key);
    //         if (e.key === "ArrowRight") {
    //             handleNextToken();
    //         } else if (e.key === "ArrowLeft") {
    //             handlePrevToken();
    //         }
    //     });
    //     return () => {
    //         window.removeEventListener("keydown", (e) => {
    //             if (e.key === "ArrowRight") {
    //                 handleNextToken();
    //             } else if (e.key === "ArrowLeft") {
    //                 handlePrevToken();
    //             }
    //         });
    //     };
    // }, [handleNextToken, handlePrevToken]);

    return (
        <div className="p-4 flex flex-col grow">
            <div className="flex justify-between items-center my-4">
                <button
                    className="btn"
                    onClick={handlePrevToken}
                    disabled={!prevToken}
                >
                    <ArrowLeft />
                </button>
                <div>
                    {token.index + 1} / {currentGeneration.length}
                </div>
                <button
                    className="btn"
                    onClick={handleNextToken}
                    disabled={!nextToken}
                >
                    <ArrowRight />
                </button>
            </div>
            <div className="flex items-center gap-3 mt-4">
                <div
                    style={{
                        //@ts-expect-error This is how it works
                        "--value": token.confidence * 100,
                        "--size": "3rem",
                    }}
                    className={`radial-progress ${getColor(token.confidence)}`}
                >
                    {token.confidence.toFixed(2)}
                </div>
                <div className="text-lg">{token.token}</div>
            </div>
            <div className="flex flex-col gap-2 mt-4">
                {token.tags.map((tag) => (
                    <div key={tag} className="badge badge-outline badge-sm">
                        {tag}
                    </div>
                ))}
            </div>
            <div className="divider" />
            <div>
                {token.prompt || token.manual ? (
                    <div className="text-xl text-secondary-content">
                        {token.prompt ? "Prompt" : "Manual"}
                    </div>
                ) : (
                    <AlternativeTokens
                        token={token}
                        tokens={token.allTokens}
                        confidences={token.allConfidences}
                        onClick={handleSubstituteToken}
                    />
                )}
            </div>
            <div className="divider" />
            <div className="flex gap-2 mb-4">
                <button
                    className={`btn btn-sm ${generationMode === "continue" ? "" : "btn-ghost"}`}
                    onClick={() => setGenerationMode("continue")}
                >
                    continue
                </button>
                <button
                    className={`btn btn-sm ${generationMode === "fim" ? "" : "btn-ghost"}`}
                    onClick={() => setGenerationMode("fim")}
                >
                    FIM
                </button>
            </div>
            {generationMode === "continue" ? (
                <div className="flex flex-col gap-2">
                    <input
                        type="text"
                        className="input"
                        placeholder="Enter token"
                        value={substituteToken}
                        onChange={handleSubstituteTokenChange}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={() => handleSubstituteToken(substituteToken)}
                    >
                        Replace Token
                    </button>
                </div>
            ) : generationMode === "fim" ? (
                <FimPanel />
            ) : null}
        </div>
    );
}

export default function GenerationSidebar() {
    const token = generationStore.selectedToken.value;
    const currentGeneration = generationStore.currentGenerationSignal.value;
    if (!token || currentGeneration.length === 0)
        return (
            <div className="h-full flex items-center justify-center grow">
                <div className="">Select a Token</div>
            </div>
        );
    return <Content token={token} />;
}
