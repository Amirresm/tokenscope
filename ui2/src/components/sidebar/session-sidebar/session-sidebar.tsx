import React from "react";
import generationStore from "../../../store/generationStore";
import { useQuery } from "@tanstack/react-query";
import sessionStore from "../../../store/sessionStore";
import { prefillGeneration } from "../../../api/generationAPI";
import { fetchSessions, fetchSessionBranches } from "../../../api/sessionAPI";

const SessionSidebar = () => {
    const sessionId = sessionStore.sessionId.value;
    const selectedBranch = sessionStore.branchId.value;

    const isGenerating = generationStore.isGenerating.value;

    const sessionQuery = useQuery({
        queryKey: ["sessions"],
        queryFn: () => fetchSessions(),
    });

    const branchQuery = useQuery({
        queryKey: ["branches", sessionId],
        queryFn: () =>
            sessionId ? fetchSessionBranches(sessionId) : Promise.resolve([]),
        enabled: !!sessionId,
    });

    const handlePrefillGeneration = React.useCallback(
        async (sessionId: string, branchId: string) => {
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

            generationStore.selectedToken.value = undefined;
            generationStore.generationAbort.value = new AbortController();
            await prefillGeneration(
                sessionId || "",
                branchId,
                generationStore.appendToGeneration,
                undefined,
                generationStore.generationAbort.value,
            );

            generationStore.isGenerating.value = false;
        },
        [isGenerating],
    );

    const handleSessionChange = React.useCallback(
        async (sessionId: string) => {
            sessionStore.setSessionId(sessionId);
            const branches = await fetchSessionBranches(sessionId);
            if (branches && branches.length > 0) {
                const lastBranch = branches[branches.length - 1];
                sessionStore.setBranchId(lastBranch);
                await handlePrefillGeneration(sessionId, lastBranch);
            } else {
                console.warn(
                    "No branches found for session:",
                    sessionId,
                    branches,
                );
                sessionStore.setBranchId(null);
            }
        },
        [branchQuery.data],
    );

    const handleBranchChange = React.useCallback(
        async (branchId: string) => {
            sessionStore.setBranchId(branchId);
            await handlePrefillGeneration(sessionId!, branchId);
        },
        [sessionId],
    );

    return (
        <div className="w-full h-full flex flex-col">
            <div className="p-2">
                <label className="block mb-1 font-medium">Session</label>
                <select
                    className="w-full p-2 select"
                    value={sessionId || ""}
                    onChange={(e) => handleSessionChange(e.target.value)}
                >
                    <option value="" disabled>
                        Select a session
                    </option>
                    {sessionQuery.data?.map((session) => (
                        <option key={session} value={session}>
                            {session}
                        </option>
                    ))}
                </select>
            </div>
            {sessionId ? (
                (branchQuery.data?.length ?? 0) > 0 ? (
                    <div className="p-2">
                        <label className="block mb-1 font-medium">Branch</label>
                        <select
                            className="w-full p-2 select"
                            value={selectedBranch || ""}
                            onChange={(e) => handleBranchChange(e.target.value)}
                        >
                            <option value="" disabled>
                                Select a branch
                            </option>
                            {branchQuery.data?.map((branch) => (
                                <option key={branch} value={branch}>
                                    {branch}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div className="p-2">
                        <p className="text-sm italic text-gray-500">
                            No branches available for this session.
                        </p>
                    </div>
                )
            ) : (
                <div className="p-2">
                    <p className="text-sm italic text-gray-500">
                        Select a session to view branches.
                    </p>
                </div>
            )}
        </div>
    );
};

export default SessionSidebar;
