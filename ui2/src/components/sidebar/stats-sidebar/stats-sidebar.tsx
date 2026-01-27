import React from "react";
import generationStore from "../../../store/generationStore";

import * as ss from "simple-statistics";
import projectsStore from "../../../store/projectsStore";
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    CheckIcon,
    XIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { fetchProjectInfo, fetchSample } from "../../../api/projectsAPI";
import { METRICLABELS } from "../../../constants/labels";

export default function StatsSidebar() {
    const currentGeneration = generationStore.currentGeneration.value;
    const fimStartIndex = generationStore.fimStartToken.value;
    const fimEndIndex = generationStore.fimEndToken.value;

    const stats = React.useMemo(() => {
        const promptTokens = currentGeneration.filter(
            (token) =>
                token.tokenTypes.includes("prompt") ||
                token.tokenTypes.includes("manual"),
        );
        const generationTokens = currentGeneration.filter(
            (token) =>
                token.position > (fimStartIndex || -1) &&
                token.position <= (fimEndIndex || 999999) &&
                !token.tokenTypes.includes("prompt") &&
                !token.tokenTypes.includes("manual"),
        );

        const confAvg =
            generationTokens.length > 0
                ? ss.mean(generationTokens.map((token) => token.confidence))
                : 0;
        const lastPPLAvg =
            generationTokens.length > 0
                ? ss.mean(
                      generationTokens
                          .map((token) => token.lastPerplexity)
                          .filter(
                              (ppl): ppl is number =>
                                  typeof ppl === "number" && !isNaN(ppl),
                          ),
                  )
                : 0;

        const promptPerplexity =
            promptTokens.length > 0
                ? promptTokens[promptTokens.length - 1]?.perplexity
                : undefined;

        const seqPerplexity =
            generationTokens[generationTokens.length - 1]?.perplexity;

        return {
            generatedTokensCount: generationTokens.length,
            confAvg,
            lastPPLAvg,
            promptPerplexity,
            seqPerplexity,
        };
    }, [currentGeneration, fimEndIndex, fimStartIndex]);

    const selectedProject = projectsStore.selectedProject.value;
    const selectedProjectSampleInfo = projectsStore.selectedSampleInfo.value;
    const projectInfoQuery = useQuery({
        queryKey: ["projectInfo", selectedProject],
        queryFn: () => fetchProjectInfo(selectedProject || ""),
        enabled: !!selectedProject,
    });

    const [nextSampleTaskId, prevSampleTaskId] = React.useMemo(() => {
        if (!selectedProjectSampleInfo) {
            return [null, null];
        }
        const samples = projectInfoQuery.data?.samples || [];
        const sampleIndex = samples.findIndex(
            (sample) => sample.id === selectedProjectSampleInfo.taskId,
        );
        const nextSample = samples[sampleIndex + 1];
        const prevSample = samples[sampleIndex - 1];
        return [
            nextSample ? nextSample.id : null,
            prevSample ? prevSample.id : null,
        ];
    }, [projectInfoQuery.data?.samples, selectedProjectSampleInfo]);

    const totalTokenTime = React.useMemo(() => {
        if (!currentGeneration) return 0;
        return currentGeneration.reduce(
            (acc, token) => acc + token.tokenTimeMs,
            0,
        );
    }, [currentGeneration]);

    const appendToGeneration = generationStore.appendToGeneration;
    const clearGeneration = generationStore.clearGeneration;
    const handleNavigateSamples = React.useCallback(
        async (sampleId: string) => {
            if (!selectedProject) {
                return;
            }
            const sample = await fetchSample(selectedProject, sampleId);
            if (!sample) {
                return;
            }
            clearGeneration();

            projectsStore.selectedSampleInfo.value = {
                taskId: sample.taskId,
                passed: sample.passed,
                details: sample.details,
                tests: sample.tests,
                canonicalSolution: sample.canonicalSolution,
                tokens: sample.tokens,
            };

            const tokens = sample.tokens;

            for (const token of tokens) {
                appendToGeneration(token);
            }
        },
        [appendToGeneration, clearGeneration, selectedProject],
    );

    return stats ? (
        <div className="w-full flex flex-col gap-2">
            <div className="card w-full bg-base-100 grow">
                <div className="card-body">
                    <h2 className="card-title">Statistics</h2>
                    <button
                        className="btn btn-ghost btn-secondary mb-4"
                        onClick={() => {
                            const modal = document.getElementById(
                                "trend_modal",
                            ) as HTMLDialogElement;
                            modal.showModal();
                        }}
                    >
                        View Trends Chart
                    </button>

                    <div className="stats stats-vertical shadow">
                        <div className="stat">
                            <div className="stat-title">Generated Tokens</div>
                            <div className="stat-value">
                                {stats.generatedTokensCount}
                            </div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">
                                Total Generation Time
                            </div>
                            <div className="stat-value text-lg">
                                {totalTokenTime.toFixed(2)} ms
                            </div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">
                                Average Generation Time
                            </div>
                            <div className="stat-value text-lg">
                                {(
                                    totalTokenTime / stats.generatedTokensCount
                                ).toFixed(2)}
                                ms
                            </div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">
                                Average {METRICLABELS.confidence}
                            </div>
                            <div className="stat-value">
                                {stats.confAvg.toFixed(2)}
                            </div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">
                                Average {METRICLABELS.lastPerplexity}
                            </div>
                            <div className="stat-value">
                                {stats.lastPPLAvg.toFixed(2)}
                            </div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">Prompt Perplexity</div>
                            <div className="stat-value">
                                {stats.promptPerplexity?.toFixed(2) || "N/A"}
                            </div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">
                                Total Sequence Perplexity
                            </div>
                            <div className="stat-value">
                                {stats.seqPerplexity?.toFixed(2) || "N/A"}
                            </div>
                        </div>
                        {/* <div className="stat"> */}
                        {/*     <div className="stat-title"> */}
                        {/*         Geometric Mean Confidence */}
                        {/*     </div> */}
                        {/*     <div className="stat-value"> */}
                        {/*         {stats.confGeometricMean.toFixed(2)} */}
                        {/*     </div> */}
                        {/* </div> */}
                        {/* <div className="stat"> */}
                        {/*     <div className="stat-title">Confidence StdDev</div> */}
                        {/*     <div className="stat-value"> */}
                        {/*         {stats.confStdev.toFixed(2)} */}
                        {/*     </div> */}
                        {/* </div> */}
                        {/* <div className="stat"> */}
                        {/*     <div className="stat-title"> */}
                        {/*         Confidence Percentiles */}
                        {/*     </div> */}
                        {/*     <div className="stat-value text-sm"> */}
                        {/*         {confidenceTenPercentiles */}
                        {/*             .map((p) => p.toFixed(2)) */}
                        {/*             .join(", ")} */}
                        {/*     </div> */}
                        {/* </div> */}
                        {/* <div className="stat"> */}
                        {/*     <div className="stat-title"> */}
                        {/*         Perplexity Percentiles */}
                        {/*     </div> */}
                        {/*     <div className="stat-value text-sm"> */}
                        {/*         {perplexityTenPercentiles */}
                        {/*             .map((p) => p.toFixed(2)) */}
                        {/*             .join(", ")} */}
                        {/*     </div> */}
                        {/* </div> */}
                        {/* <div className="stat"> */}
                        {/*     <div className="stat-title"> */}
                        {/*         Last Perplexity Percentiles */}
                        {/*     </div> */}
                        {/*     <div className="stat-value text-sm"> */}
                        {/*         {lastPerplexityTenPercentiles */}
                        {/*             .map((p) => p.toFixed(2)) */}
                        {/*             .join(", ")} */}
                        {/*     </div> */}
                        {/* </div> */}
                        {/* <div className="stat"> */}
                        {/*     <div className="stat-title"> */}
                        {/*         Margin Confidence Percentiles */}
                        {/*     </div> */}
                        {/*     <div className="stat-value text-sm"> */}
                        {/*         {marginConfidenceTenPercentiles */}
                        {/*             .map((p) => p.toFixed(2)) */}
                        {/*             .join(", ")} */}
                        {/*     </div> */}
                        {/* </div> */}
                        {/* <div className="stat"> */}
                        {/*     <div className="stat-title"> */}
                        {/*         Entropy Percentiles */}
                        {/*     </div> */}
                        {/*     <div className="stat-value text-sm"> */}
                        {/*         {entropyTenPercentiles */}
                        {/*             .map((p) => p.toFixed(2)) */}
                        {/*             .join(", ")} */}
                        {/*     </div> */}
                        {/* </div> */}
                    </div>
                </div>
            </div>
            {selectedProjectSampleInfo && (
                <div className="flex gap-1 items-center justify-between">
                    <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => {
                            if (prevSampleTaskId) {
                                handleNavigateSamples(prevSampleTaskId);
                            }
                        }}
                        disabled={!prevSampleTaskId}
                    >
                        <ArrowLeftIcon />
                    </button>
                    <div className="flex gap-1 items-center">
                        {selectedProjectSampleInfo.passed === true ? (
                            <CheckIcon
                                size={24}
                                color="green"
                                className="inline-block"
                            />
                        ) : selectedProjectSampleInfo.passed === false ? (
                            <XIcon
                                size={24}
                                color="red"
                                className="inline-block"
                            />
                        ) : null}
                        {selectedProjectSampleInfo.taskId}
                    </div>
                    <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => {
                            if (nextSampleTaskId) {
                                handleNavigateSamples(nextSampleTaskId);
                            }
                        }}
                        disabled={!nextSampleTaskId}
                    >
                        <ArrowRightIcon />
                    </button>
                </div>
            )}
        </div>
    ) : (
        <div className="card w-full bg-base-100">
            <div className="card-body">
                <h2 className="card-title">Stats</h2>
                <p>No stats available</p>
            </div>
        </div>
    );
}
