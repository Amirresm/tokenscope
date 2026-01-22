import React from "react";
import "./generation-sidebar.css";
import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react";
import AlternativeTokens from "./alternative-tokens";
import { GenerationToken } from "../../../models/generationToken";
import sessionStore from "../../../store/sessionStore";
import generationStore from "../../../store/generationStore";
import { continueGeneration } from "../../../api/generationAPI";
import { METRICLABELS } from "../../../constants/labels";

// type GenerationMode = "continue" | "fim";

const colorMap = {
    0.0: "text-[var(--grade-1)]",
    0.25: "text-[var(--grade-2)]",
    0.5: "text-[var(--grade-3)]",
    0.75: "text-[var(--grade-4)]",
    0.98: "text-[var(--grade-5)]",
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

function Navigation({ token }: { token: GenerationToken }) {
    const currentGeneration = generationStore.currentGeneration.value;
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
    return (
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
    );
}

export function Content({ token }: { token: GenerationToken }) {
    const sessionId = sessionStore.sessionId.value;
    const branchId = sessionStore.branchId.value;

    const [substituteToken, setSubstituteToken] = React.useState("");
    // const [generationMode, setGenerationMode] =
    //     React.useState<GenerationMode>("continue");

    const handleSubstituteTokenChange = React.useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

            await continueGeneration(
                sessionId,
                branchId,
                token.position,
                tokens,
                generationStore.generationSettings.value,
                false,
                generationStore.appendToGeneration,
                undefined,
                generationStore.generationAbort.value,
            );

            generationStore.isGenerating.value = false;
        },
        [token.position, sessionId, branchId],
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
        <div className="h-full overflow-y-auto p-4 flex flex-col grow">
            <Navigation token={token} />
            <div className="flex items-center gap-3 mt-4">
                <div
                    style={{
                        //@ts-expect-error This is how it works
                        "--value": token.confidence * 100,
                        "--size": "3rem",
                    }}
                    className={`radial-progress ${getColor(token.confidence)} text-xs`}
                >
                    {token.confidence.toFixed(3)}
                </div>
                <div className="text-lg whitespace-pre">
                    {visualizeWhitespace(token.token)}
                </div>
            </div>
            {/* <div className="mt-6 text-sm text-gray-500"> */}
            {/*     {token.tokenTimeMs} ms */}
            {/* </div> */}
            <div className="divider" />
            <div className="flex gap-2 flex-wrap">
                {token.tokenTypes.length > 0 ? (
                    token.tokenTypes.map((type) => (
                        <div
                            key={type}
                            className="badge badge-outline badge-sm"
                        >
                            {type}
                        </div>
                    ))
                ) : (
                    <div className="text-sm italic text-gray-500">
                        Not a Special Token Type
                    </div>
                )}
            </div>
            <div className="divider" />
            <div className="overflow-x-auto min-h-44">
                <table className="table">
                    <thead>
                        <tr className="text-xs">
                            <th>Metric</th>
                            <th className="text-center">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="text-xs">
                            <td>Generation Time</td>
                            <td className="text-center">
                                {token.tokenTimeMs} ms
                            </td>
                        </tr>
                        <tr className="text-xs">
                            <td>{METRICLABELS.perplexity}</td>
                            <td className="text-center">
                                {token.perplexity === undefined
                                    ? "Not Calculated"
                                    : isNaN(token.perplexity)
                                      ? "N/A"
                                      : token.perplexity.toFixed(6)}
                            </td>
                        </tr>
                        <tr className="text-xs">
                            <td>{METRICLABELS.lastPerplexity}</td>
                            <td className="text-center">
                                {token.lastPerplexity === undefined
                                    ? "Not Calculated"
                                    : isNaN(token.lastPerplexity)
                                      ? "N/A"
                                      : token.lastPerplexity.toFixed(6)}
                            </td>
                        </tr>
                        <tr className="text-xs">
                            <td>{METRICLABELS.marginConfidence}</td>
                            <td className="text-center">
                                {token.marginConfidence === undefined
                                    ? "Not Calculated"
                                    : token.marginConfidence.toFixed(6)}
                            </td>
                        </tr>
                        <tr className="text-xs">
                            <td>{METRICLABELS.entropy}</td>
                            <td className="text-center">
                                {token.entropy === undefined
                                    ? "Not Calculated"
                                    : token.entropy.toFixed(6)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div className="divider" />
            <div>
                {token.prompt || token.manual ? (
                    <div className="text-sm italic text-gray-500">
                        No Alternative Tokens For '
                        {token.prompt ? "Prompt" : "Manual"}' Token
                    </div>
                ) : token.alternativeTokens &&
                  token.alternativeTokens.length > 0 ? (
                    <AlternativeTokens
                        token={token}
                        alternativeTokens={token.alternativeTokens}
                        onClick={handleSubstituteToken}
                    />
                ) : (
                    <div className="text-sm italic text-gray-500">
                        No Alternative Tokens Available
                    </div>
                )}
            </div>
            <div className="divider" />
            <div className="flex gap-2 mb-4">
                {/* <button */}
                {/*     className={`btn btn-sm ${generationMode === "continue" ? "" : "btn-ghost"}`} */}
                {/*     onClick={() => setGenerationMode("continue")} */}
                {/* > */}
                {/*     continue */}
                {/* </button> */}
                {/* <button */}
                {/*     className={`btn btn-sm ${generationMode === "fim" ? "" : "btn-ghost"}`} */}
                {/*     onClick={() => setGenerationMode("fim")} */}
                {/* > */}
                {/*     FIM */}
                {/* </button> */}
                Replace Token With
            </div>
            {/* {generationMode === "continue" ? ( */}
            {/*     <div className="flex flex-col gap-2"> */}
            {/*         <textarea */}
            {/*             className="input p-2" */}
            {/*             placeholder="Enter token (or tokens) to substitute" */}
            {/*             value={substituteToken} */}
            {/*             onChange={handleSubstituteTokenChange} */}
            {/*         /> */}
            {/*         <button */}
            {/*             className="btn btn-primary" */}
            {/*             onClick={() => handleSubstituteToken(substituteToken)} */}
            {/*         > */}
            {/*             Replace Token */}
            {/*         </button> */}
            {/*     </div> */}
            {/* ) : generationMode === "fim" ? ( */}
            {/*     <FimPanel /> */}
            {/* ) : null} */}
            <div className="flex flex-col gap-2">
                <textarea
                    className="input p-2"
                    placeholder="Enter token (or tokens) to substitute"
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
        </div>
    );
}

export default function GenerationSidebar() {
    const token = generationStore.selectedToken.value;
    const currentGeneration = generationStore.currentGeneration.value;
    if (!token || currentGeneration.length === 0)
        return (
            <div className="h-full flex items-center justify-center p-4 italic text-gray-500 text-center">
                <div className="">Select a Token</div>
            </div>
        );
    return <Content token={token} />;
}
