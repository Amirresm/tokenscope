import React from "react";
import "./generation-sidebar.css";
import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react";
import AlternativeTokens from "./alternative-tokens";
import FimPanel from "./fim-panel";
import { GenerationToken } from "../../../models/generationToken";
import sessionStore from "../../../store/sessionStore";
import generationStore from "../../../store/generationStore";
import { continueGeneration } from "../../../api/generationAPI";

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

function visualizeWhitespace(str: string) {
    return str
        .replace(/ /g, "␣") // space
        .replace(/\t/g, "⇥") // tab
        .replace(/\n/g, "⏎\n"); // newline
}

export function Content({ token }: { token: GenerationToken }) {
    const sessionId = sessionStore.sessionId.value;
    const branchId = sessionStore.branchId.value;

    const [substituteToken, setSubstituteToken] = React.useState("");
    const [generationMode, setGenerationMode] =
        React.useState<GenerationMode>("continue");

    const currentGeneration = generationStore.currentGeneration.value;
    const nextToken = generationStore.nextToken.value;
    const prevToken = generationStore.previousToken.value;

    const attentionTargetToken = generationStore.attentionTargetToken.value;
    const attentionTargetHead = generationStore.attentionTargetHead.value;

    // const attentionTargetHeadCount =
    //     currentGeneration.find(
    //         (t) =>
    //             t.attentionSnapshot?.length && t.attentionSnapshot.length > 0,
    //     )?.attentionSnapshot?.length || 0;
    // const attentionTargetHeadOptions = [
    //     ...Array(attentionTargetHeadCount).keys(),
    // ];
    const attentionTargetHeadOptions = React.useMemo(() => {
        if (currentGeneration.length === 0) return [];
        const firstWithAttention = currentGeneration.find(
            (t) =>
                t.attentionSnapshot &&
                Object.keys(t.attentionSnapshot).length > 0,
        );
        if (!firstWithAttention) return [];
        return Object.keys(firstWithAttention.attentionSnapshot!);
    }, [currentGeneration]);

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
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setSubstituteToken(e.target.value);
        },
        [],
    );

    const handleSetAttentionTargetToken = React.useCallback(() => {
        generationStore.setAttentionTargetToken(token);
    }, [token]);

    const handleSubstituteToken = React.useCallback(
        async (tokens: string) => {
            if (generationStore.generationAbort.value) {
                generationStore.generationAbort.value.abort();
            }

            generationStore.clearGeneration();

            generationStore.isGenerating.value = true;
            generationStore.paused.value = false;

            generationStore.generationAbort.value = new AbortController();

            await continueGeneration(
                sessionId,
                branchId,
                token.position,
                tokens,
                generationStore.maxTokens.value,
                false,
                generationStore.attnLayer.value,
                generationStore.appendToGeneration,
                undefined,
                generationStore.generationAbort.value,
            );

            generationStore.isGenerating.value = false;
        },
        [currentGeneration, token.position, sessionId, branchId],
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
                    <ArrowLeftIcon />
                </button>
                <div>
                    {token.position + 1} / {currentGeneration.length}
                </div>
                <button
                    className="btn"
                    onClick={handleNextToken}
                    disabled={!nextToken}
                >
                    <ArrowRightIcon />
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
                <div className="text-lg whitespace-pre">
                    {visualizeWhitespace(token.token)}
                </div>
            </div>
            <div className="flex flex-col gap-2 mt-4">
                {token.tokenTypes.map((type) => (
                    <div key={type} className="badge badge-outline badge-sm">
                        {type}
                    </div>
                ))}
            </div>
            <div className="mt-4 flex items-center">
                <div>{token.branchId}</div>
                <div className="grow" />
                <div>
                    {token.perplexity === undefined
                        ? "Not Calculated"
                        : isNaN(token.perplexity)
                          ? "N/A"
                          : token.perplexity.toFixed(3)}
                </div>
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
                        alternativeTokens={token.alternativeTokens || []}
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
                    <textarea
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

            <div className="divider" />
            <div className="flex flex-col gap-2">
                <div className="text-sm">
                    {token.relativeAttention !== undefined
                        ? `Relative Attention: ${token.relativeAttention?.toFixed(3)}`
                        : "No Relative Attention"}
                </div>
                <div className="flex items-center">
                    <div className="dropdown dropdown-top">
                        <div
                            tabIndex={0}
                            role="button"
                            className="btn btn-ghost btn-sm"
                        >
                            <span
                                className={`${attentionTargetHeadOptions.length === 0 ? "text-gray-500" : ""}`}
                            >
                                Head {attentionTargetHead}
                            </span>
                        </div>
                        <ul
                            tabIndex={0}
                            className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
                        >
                            {attentionTargetHeadOptions.map((option) => (
                                <li
                                    key={option}
                                    onClick={() =>
                                        generationStore.setAttentionTargetHead(
                                            option,
                                        )
                                    }
                                >
                                    <a>{option}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <button
                        className="btn btn-ghost grow"
                        onClick={handleSetAttentionTargetToken}
                        disabled={attentionTargetHeadOptions.length === 0}
                    >
                        {token.position === attentionTargetToken?.position
                            ? "Remove Attention Target"
                            : "Set Attention Target"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function GenerationSidebar() {
    const token = generationStore.selectedToken.value;
    const currentGeneration = generationStore.currentGeneration.value;
    if (!token || currentGeneration.length === 0)
        return (
            <div className="h-full flex items-center justify-center grow">
                <div className="">Select a Token</div>
            </div>
        );
    return <Content token={token} />;
}
