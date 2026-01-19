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

export default function StatsSidebar() {
    const currentGeneration = generationStore.currentGeneration.value;
    const fimStartIndex = generationStore.fimStartToken.value;
    const fimEndIndex = generationStore.fimEndToken.value;

    const confidenceTenPercentiles =
        generationStore.confidenceTenPercentiles.value;
    const perplexityTenPercentiles =
        generationStore.perplexityTenPercentiles.value;
    const lastPerplexityTenPercentiles =
        generationStore.lastPerplexityTenPercentiles.value;
    const marginConfidenceTenPercentiles =
        generationStore.marginConfidenceTenPercentiles.value;
    const entropyTenPercentiles = generationStore.entropyTenPercentiles.value;

    const stats = React.useMemo(() => {
        const tokens = currentGeneration.filter(
            (token) =>
                token.position > (fimStartIndex || -1) &&
                token.position <= (fimEndIndex || 999999) &&
                !token.tokenTypes.includes("prompt") &&
                !token.tokenTypes.includes("manual"),
        );

        if (!tokens.length) {
            return null;
        }

        const confAvg = ss.mean(tokens.map((token) => token.confidence));
        const confGeometricMean = ss.geometricMean(
            tokens.map((token) => token.confidence),
        );

        const confStdev = ss.standardDeviation(
            tokens.map((token) => token.confidence),
        );

        return {
            generatedTokensCount: tokens.length,
            confAvg,
            confGeometricMean,
            confStdev,
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
                    <h2 className="card-title">Stats</h2>
                    <button
                        className="btn btn-ghost btn-secondary mb-4"
                        onClick={() => {
                            const modal = document.getElementById(
                                "trend_modal",
                            ) as HTMLDialogElement;
                            modal.showModal();
                        }}
                    >
                        Show Trend Chart
                    </button>

                    <div className="stats stats-vertical shadow">
                        <div className="stat">
                            <div className="stat-title">
                                Generated Tokens Time
                            </div>
                            <div className="stat-value text-sm">
                                {totalTokenTime.toFixed(2)} ms (Avg:{" "}
                                {(
                                    totalTokenTime / stats.generatedTokensCount
                                ).toFixed(2)}
                                ms)
                            </div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">Generated Tokens</div>
                            <div className="stat-value">
                                {stats.generatedTokensCount}
                            </div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">Average Confidence</div>
                            <div className="stat-value">
                                {stats.confAvg.toFixed(2)}
                            </div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">
                                Geometric Mean Confidence
                            </div>
                            <div className="stat-value">
                                {stats.confGeometricMean.toFixed(2)}
                            </div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">Confidence StdDev</div>
                            <div className="stat-value">
                                {stats.confStdev.toFixed(2)}
                            </div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">
                                Confidence Percentiles
                            </div>
                            <div className="stat-value text-sm">
                                {confidenceTenPercentiles
                                    .map((p) => p.toFixed(2))
                                    .join(", ")}
                            </div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">
                                Perplexity Percentiles
                            </div>
                            <div className="stat-value text-sm">
                                {perplexityTenPercentiles
                                    .map((p) => p.toFixed(2))
                                    .join(", ")}
                            </div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">
                                Last Perplexity Percentiles
                            </div>
                            <div className="stat-value text-sm">
                                {lastPerplexityTenPercentiles
                                    .map((p) => p.toFixed(2))
                                    .join(", ")}
                            </div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">
                                Margin Confidence Percentiles
                            </div>
                            <div className="stat-value text-sm">
                                {marginConfidenceTenPercentiles
                                    .map((p) => p.toFixed(2))
                                    .join(", ")}
                            </div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">
                                Entropy Percentiles
                            </div>
                            <div className="stat-value text-sm">
                                {entropyTenPercentiles
                                    .map((p) => p.toFixed(2))
                                    .join(", ")}
                            </div>
                        </div>
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
