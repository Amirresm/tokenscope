import { PlusIcon, RobotIcon } from "@phosphor-icons/react";
import React from "react";
import sessionStore from "../../store/sessionStore";
import { useQuery } from "@tanstack/react-query";
import { fetchCurrentModel } from "../../api/llmManagementAPI";

export function MainBar() {
    const currentModelQuery = useQuery({
        queryKey: ["current-model"],
        queryFn: async () => fetchCurrentModel(),
    });

    const modelName = currentModelQuery.data?.modelNameOrPath
        ? currentModelQuery.data.modelNameOrPath?.split("/")[
              currentModelQuery.data.modelNameOrPath?.split("/").length - 1
          ]
        : "No Model Loaded";

    const handleNewSession = React.useCallback(() => {
        sessionStore.resetSession();
    }, []);

    return (
        <div className="flex flex-col items-center gap-2 my-4">
            <button
                className={`btn btn-ghost btn-sm btn-primary btn-square`}
                onClick={handleNewSession}
            >
                <PlusIcon />
            </button>
            <button
                className={`btn btn-ghost btn-sm btn-square`}
                onClick={() => {
                    const modal = document.getElementById(
                        "llm_management_modal",
                    ) as HTMLDialogElement;
                    modal.showModal();
                }}
            >
                <RobotIcon />
            </button>
            <div className="divider divider-horizontal mx-0 grow self-center"></div>
        </div>
    );
}
