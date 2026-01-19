import { PlusIcon, RobotIcon } from "@phosphor-icons/react";
import React from "react";
import sessionStore from "../../store/sessionStore";
import { useCurrentModelQuery } from "../../hooks/current-model-query";
import generationStore from "../../store/generationStore";
import drawerStore, {
    DrawerTabsEnum,
} from "../../store/components/drawerStore";

export function MainBar() {
    const currentModelQuery = useCurrentModelQuery();
    const modelName = currentModelQuery.data?.modelName || "No Model Loaded";

    const handleNewSession = React.useCallback(() => {
        generationStore.resetGenerationStore();
        sessionStore.resetSession();
        drawerStore.closeDrawer();
        drawerStore.setDrawerTab(DrawerTabsEnum.SESSION);
    }, []);

    return (
        <div className="flex flex-col items-center gap-2 my-4">
            <div className="tooltip tooltip-right" data-tip="Start New Session">
                <button
                    className={`btn btn-ghost btn-sm btn-primary`}
                    onClick={handleNewSession}
                >
                    <PlusIcon />
                </button>
            </div>
            <div
                className="tooltip tooltip-right"
                data-tip={`Current Model: ${modelName}`}
            >
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                        const modal = document.getElementById(
                            "llm_management_modal",
                        ) as HTMLDialogElement;
                        modal.showModal();
                    }}
                >
                    <RobotIcon />
                </button>
            </div>
            <div className="divider divider-horizontal mx-0 grow self-center"></div>
        </div>
    );
}
