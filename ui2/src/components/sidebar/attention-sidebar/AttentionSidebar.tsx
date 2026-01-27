import React from "react";
import generationStore from "../../../store/generationStore";
import { GenerationToken } from "../../../models/generationToken";
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    QuestionIcon,
} from "@phosphor-icons/react";
import { METRICLABELS } from "../../../constants/labels";

function Navigation({ token }: { token: GenerationToken }) {
    const currentGeneration = generationStore.currentGeneration.value;
    const nextToken = generationStore.nextToken.value;
    const prevToken = generationStore.previousToken.value;

    const handleNextToken = React.useCallback(() => {
        if (nextToken) {
            generationStore.selectedToken.value = nextToken;
            generationStore.setAttentionTargetToken(nextToken);
        }
    }, [nextToken]);

    const handlePrevToken = React.useCallback(() => {
        if (prevToken) {
            generationStore.selectedToken.value = prevToken;
            generationStore.setAttentionTargetToken(prevToken);
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

function Header({ token }: { token: GenerationToken }) {
    const currentGeneration = generationStore.currentGeneration.value;
    const attentionTargetHead = generationStore.attentionTargetHead.value;
    const attentionTargetToken = generationStore.attentionTargetToken.value;

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

    const [nextHead, prevHead] = React.useMemo(() => {
        if (attentionTargetHeadOptions.length === 0) {
            return [undefined, undefined];
        }
        const currentIndex = attentionTargetHeadOptions.findIndex(
            (h) => h === attentionTargetHead,
        );
        const nextIndex =
            currentIndex === -1 ||
            currentIndex === attentionTargetHeadOptions.length - 1
                ? 0
                : currentIndex + 1;
        const prevIndex =
            currentIndex === -1 || currentIndex === 0
                ? attentionTargetHeadOptions.length - 1
                : currentIndex - 1;
        return [
            attentionTargetHeadOptions[nextIndex],
            attentionTargetHeadOptions[prevIndex],
        ];
    }, [attentionTargetHead, attentionTargetHeadOptions]);

    const handleSetAttentionTargetToken = React.useCallback(() => {
        generationStore.setAttentionTargetToken(token);
    }, [token]);

    return (
        <div className="flex justify-between items-center flex-wrap">
            <button
                className="flex-1/2 btn btn-ghost btn-sm"
                onClick={handleSetAttentionTargetToken}
                disabled={
                    attentionTargetHeadOptions.length === 0 ||
                    token.position === attentionTargetToken?.position
                }
            >
                Set As Target
            </button>
            <button
                className="flex-1/2 btn btn-ghost btn-sm"
                onClick={() => generationStore.clearAttentionTargetToken()}
                disabled={
                    attentionTargetHeadOptions.length === 0 ||
                    !attentionTargetToken
                }
            >
                Clear
            </button>
            <div className="basis-full h-4" />
            <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                    generationStore.setAttentionTargetHead(prevHead!)
                }
                disabled={attentionTargetHeadOptions.length === 0 || !prevHead}
            >
                <ArrowLeftIcon />
            </button>
            <div className="flex dropdown dropdown-bottom">
                <div
                    tabIndex={0}
                    role="button"
                    className="btn btn-ghost btn-sm btn-wide"
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
                                generationStore.setAttentionTargetHead(option)
                            }
                        >
                            <a>{option}</a>
                        </li>
                    ))}
                </ul>
            </div>
            <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                    generationStore.setAttentionTargetHead(nextHead!)
                }
                disabled={attentionTargetHeadOptions.length === 0 || !nextHead}
            >
                <ArrowRightIcon />
            </button>
        </div>
    );
}
function Content({ token }: { token: GenerationToken }) {
    const currentGeneration = generationStore.currentGeneration.value;
    const attentionTargetHead = generationStore.attentionTargetHead.value;
    const attentionTargetToken = generationStore.attentionTargetToken.value;

    const [
        attentionSaliency,
        numInputs,
        numOutputs,
        avgInputAttn,
        avgOutputAttn,
        avgConf,
        avgMargin,
        avgEntropy,
        avgLPPL,
    ] = React.useMemo(() => {
        let numInputs = 0;
        let numOutputs = 0;

        let inputAttn = 0;
        let outputAttn = 0;

        let totalConf = 0;
        let totalMargin = 0;
        let totalEntropy = 0;
        let totalLPPL = 0;

        const attentionSaliency =
            attentionTargetHead &&
            currentGeneration.length > 0 &&
            token.attentionSaliences[attentionTargetHead]
                ? token.attentionSaliences[attentionTargetHead]
                : 0;

        if (token.attentionSnapshot && attentionTargetHead) {
            const attns = token.attentionSnapshot[attentionTargetHead];
            for (const t of currentGeneration) {
                for (const attn of attns) {
                    if (attn.index === t.position) {
                        if (t.prompt || t.manual) {
                            numInputs++;
                            inputAttn += attn.attention;
                        } else {
                            numOutputs++;
                            outputAttn += attn.attention;
                            totalConf += (t.confidence || 0) * attn.attention;
                            totalMargin +=
                                (t.marginConfidence || 0) * attn.attention;
                            totalEntropy += (t.entropy || 0) * attn.attention;
                            totalLPPL +=
                                (t.lastPerplexity || 0) * attn.attention;
                        }
                    }
                }
            }
        }
        const avgInputAttn = numInputs > 0 ? inputAttn / numInputs : 0;
        const avgOutputAttn = numOutputs > 0 ? outputAttn / numOutputs : 0;
        const avgConf = numOutputs > 0 ? totalConf / numOutputs : 0;
        const avgMargin = numOutputs > 0 ? totalMargin / numOutputs : 0;
        const avgEntropy = numOutputs > 0 ? totalEntropy / numOutputs : 0;
        const avgLPPL = numOutputs > 0 ? totalLPPL / numOutputs : 0;
        return [
            attentionSaliency,
            numInputs,
            numOutputs,
            avgInputAttn,
            avgOutputAttn,
            avgConf,
            avgMargin,
            avgEntropy,
            avgLPPL,
        ];
    }, [token, currentGeneration, attentionTargetHead]);

    return (
        <div className="p-4 flex flex-col gap-2">
            <Navigation token={token} />
            <Header token={token} />
            <button
                className="btn btn-ghost btn-secondary btn-sm mt-4"
                onClick={() => {
                    const modal = document.getElementById(
                        "reverse_attention_modal",
                    ) as HTMLDialogElement;
                    modal.showModal();
                }}
                disabled={!attentionTargetHead}
            >
                Top Attending Tokens
            </button>
            <button
                className="btn btn-ghost btn-secondary btn-sm mt-4"
                onClick={() => {
                    const modal = document.getElementById(
                        "relative_attention_modal",
                    ) as HTMLDialogElement;
                    modal.showModal();
                }}
                disabled={
                    !attentionTargetHead ||
                    !attentionTargetToken ||
                    attentionTargetToken.position === token.position
                }
            >
                Attention from Token {attentionTargetToken?.position}
                {attentionTargetToken?.token ? `: "${attentionTargetToken.token}"` : ""}
            </button>
            <div className="divider my-2" />
            <table className="table w-full text-sm">
                <tbody>
                    <tr>
                        <td>{METRICLABELS.attentionSaliency}</td>
                        <td>{attentionSaliency.toFixed(3)}</td>
                    </tr>
                    {/* <tr> */}
                    {/*     <td className="flex items-center gap-1"> */}
                    {/*         Total Attention */}
                    {/*         <div */}
                    {/*             className="tooltip tooltip-top before:w-64" */}
                    {/*             data-tip="Ideally 1.0, but may vary if 'Attention Top N' is too low." */}
                    {/*         > */}
                    {/*             <QuestionIcon size={16} /> */}
                    {/*         </div> */}
                    {/*     </td> */}
                    {/*     <td> */}
                    {/*         {( */}
                    {/*             avgInputAttn * numInputs + */}
                    {/*             avgOutputAttn * numOutputs */}
                    {/*         ).toFixed(3)} */}
                    {/*     </td> */}
                    {/* </tr> */}
                    {/* <tr> */}
                    {/*     <td>Total Attention to Inputs</td> */}
                    {/*     <td>{(avgInputAttn * numInputs).toFixed(3)}</td> */}
                    {/* </tr> */}
                    {/* <tr> */}
                    {/*     <td>Total Attention to Outputs</td> */}
                    {/*     <td>{(avgOutputAttn * numOutputs).toFixed(3)}</td> */}
                    {/* </tr> */}
                    <tr>
                        <td>Number of Attended Prompt Tokens</td>
                        <td>{numInputs}</td>
                    </tr>
                    <tr>
                        <td>Number of Attended Output Tokens</td>
                        <td>{numOutputs}</td>
                    </tr>
                    <tr>
                        <td>Average Attention to Prompt</td>
                        <td>{avgInputAttn.toFixed(3)}</td>
                    </tr>
                    <tr>
                        <td>Average Attention to Output</td>
                        <td>{avgOutputAttn.toFixed(3)}</td>
                    </tr>
                    <tr>
                        <td>
                            Average {METRICLABELS.confidence} of Attended Output
                            Tokens
                        </td>
                        <td>{avgConf.toFixed(3)}</td>
                    </tr>
                    <tr>
                        <td>
                            Average {METRICLABELS.marginConfidence} of Attended
                            Output Tokens
                        </td>
                        <td>{avgMargin.toFixed(3)}</td>
                    </tr>
                    <tr>
                        <td>
                            Average {METRICLABELS.entropy} of Attended Output
                            Tokens
                        </td>
                        <td>{avgEntropy.toFixed(3)}</td>
                    </tr>
                    <tr>
                        <td>
                            Average {METRICLABELS.lastPerplexity} of Attended
                            Output Tokens
                        </td>
                        <td>{avgLPPL.toFixed(3)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

export function AttentionSidebar() {
    const selectedToken = generationStore.selectedToken.value;

    if (!selectedToken) {
        return (
            <div className="h-full flex items-center justify-center p-4 italic text-gray-500 text-center">
                Select a token to view attention details.
            </div>
        );
    }

    return <Content token={selectedToken} />;
}
