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

    const handleSessionChange = React.useCallback((sessionId: string) => {
        sessionStore.setSessionId(sessionId);
        sessionStore.setBranchId(null);
    }, []);

    const handleBranchChange = React.useCallback(
        async (branchId: string) => {
            sessionStore.setBranchId(branchId);
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
        [sessionId, isGenerating],
    );

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

    return (
        <div className="w-full h-full flex flex-col">
            <div className="p-2 border-b">
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
            {sessionId && (
                <div className="p-2 border-b">
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
            )}
        </div>
    );
};

export default SessionSidebar;
