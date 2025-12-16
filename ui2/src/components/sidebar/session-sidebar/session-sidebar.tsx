import React from "react";
import projectsStore from "../../../store/projectsStore";
import generationStore from "../../../store/generationStore";
import { useQuery } from "@tanstack/react-query";
import sessionAPI from "../../../api/sessionAPI";
import generationAPI from "../../../api/generationAPI";

const SessionSidebar = () => {
    const sessionId = generationStore.sessionId.value;
    const selectedSession = generationStore.sessionId.value;
    const selectedBranch = generationStore.branchId.value;

    const isGenerating = generationStore.isGenerating.value;

    const handleSessionChange = React.useCallback((sessionId: string) => {
        generationStore.setSessionId(sessionId);
        generationStore.setBranchId(null);
    }, []);

    const handleBranchChange = React.useCallback(async (branchId: string) => {
        generationStore.setBranchId(branchId);
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
        await generationAPI.prefillGeneration({
            sessionId: sessionId || "",
            branchId: branchId,
            abortSignal: generationStore.generationAbort.value,
            handleData: generationStore.appendToGeneration,
        });

        generationStore.isGenerating.value = false;
    }, [sessionId, isGenerating]);

    const sessionQuery = useQuery({
        queryKey: ["sessions"],
        queryFn: () => sessionAPI.getSessions(),
    });

    const branchQuery = useQuery({
        queryKey: ["branches", selectedSession],
        queryFn: () =>
            selectedSession
                ? sessionAPI.getSessionBranches(selectedSession)
                : Promise.resolve([]),
        enabled: !!selectedSession,
    });

    return (
        <div className="w-full h-full flex flex-col">
            <div className="p-2 border-b">
                <label className="block mb-1 font-medium">Session</label>
                <select
                    className="w-full p-2 select"
                    value={selectedSession || ""}
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
            {selectedSession && (
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
