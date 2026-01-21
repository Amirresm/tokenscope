import sessionStore from "../../store/sessionStore";
import { GearIcon, RobotIcon, TreeStructureIcon } from "@phosphor-icons/react";
import { TokenLevelConfigDropdown } from "../TokenLevelConfigDropdown";
import React from "react";
import globalStore from "../../store/components/globalStore";
import astStore, { ViewModesEnum } from "../../store/components/astStore";
import generationStore from "../../store/generationStore";
import drawerStore, {
    DrawerTabsEnum,
} from "../../store/components/drawerStore";
import { useCurrentModelQuery } from "../../hooks/current-model-query";
import { ASTConfigDropdown } from "../ASTConfigDropdown";

function AstPageActions() {
    const astViewMode = astStore.astViewMode.value;

    const setViewMode = React.useCallback((mode: ViewModesEnum) => {
        astStore.astViewMode.value = mode;
    }, []);

    return (
        <>
            <div className="dropdown">
                <div tabIndex={0} role="button" className="btn btn-sm">
                    AST Mode: {astViewMode}
                </div>
                <ul
                    tabIndex={0}
                    className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
                >
                    {Object.values(ViewModesEnum).map((mode) => (
                        <li key={mode} onClick={() => setViewMode(mode)}>
                            <a
                                className={
                                    astViewMode === mode ? "font-bold" : ""
                                }
                            >
                                {mode}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
            <button
                className="btn btn-ghost btn-sm"
                onClick={() => (astStore.selectedRange.value = null)}
            >
                Clear Range Selection
            </button>
        </>
    );
}

export function MainHeader() {
    const sessionId = sessionStore.sessionId.value;
    const branchId = sessionStore.branchId.value;
    const viewMode = globalStore.viewMode.value;

    const currentGeneration = generationStore.currentGeneration.value;

    const currentModelQuery = useCurrentModelQuery();
    const modelName = currentModelQuery.data?.modelName || "No Model Loaded";

    const handleChangeViewMode = React.useCallback(
        (mode: "generation" | "graph" | "ast") => () => {
            const activeElement = document.activeElement as HTMLElement;
            activeElement?.blur();
            globalStore.viewMode.value = mode;
        },
        [],
    );

    const promptTokenCount = React.useMemo(() => {
        if (!currentGeneration) return 0;
        let nonPromptTokens = 0;
        const reversedGeneration = [...currentGeneration].reverse();
        for (const t of reversedGeneration) {
            if (t.prompt || t.manual) {
                break;
            }
            nonPromptTokens += 1;
        }

        return currentGeneration.length - nonPromptTokens;
    }, [currentGeneration]);

    return (
        <header className="">
            <div className="bg-base-200 border border-base-300 rounded-xl flex items-center gap-2 m-4 mb-2 px-0 py-0 text-sm">
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
                    {modelName}
                </button>
                <div className="divider divider-horizontal mx-0"></div>
                <div className="flex justify-center items-center gap-0">
                    <TreeStructureIcon />
                    <button
                        className="btn btn-ghost btn-sm text-primary"
                        onClick={() => {
                            drawerStore.setDrawerTab(DrawerTabsEnum.SESSION);
                            drawerStore.openDrawer();
                        }}
                    >
                        {sessionId}
                    </button>
                    {">"}
                    <button
                        className="btn btn-ghost btn-sm text-primary"
                        onClick={() => {
                            drawerStore.setDrawerTab(DrawerTabsEnum.SESSION);
                            drawerStore.openDrawer();
                        }}
                    >
                        {branchId}
                    </button>
                </div>
                <div className="divider divider-horizontal mx-0"></div>
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                        const modal = document.getElementById(
                            "prompt_modal",
                        ) as HTMLDialogElement;
                        modal.showModal();
                    }}
                >
                    View Prompt ({promptTokenCount} tokens)
                </button>
                <TokenLevelConfigDropdown />
            </div>

            <div className="flex gap-2 items-center mx-4">
                {viewMode === "generation" ? (
                    <div className="dropdown">
                        <button
                            className="btn btn-sm"
                            popoverTarget="token-level-config-popover"
                            style={{
                                anchorName: "--token-level-config-anchor",
                            }}
                        >
                            <GearIcon />
                        </button>
                        <TokenLevelConfigDropdown />
                    </div>
                ) : (
                    <div className="dropdown">
                        <button
                            className="btn btn-sm"
                            popoverTarget="ast-config-dropdown"
                            style={{
                                anchorName: "--ast-config-dropdown-anchor",
                            }}
                        >
                            <GearIcon />
                        </button>
                        <ASTConfigDropdown />
                    </div>
                )}
                <div className="dropdown">
                    <div tabIndex={0} role="button" className="btn btn-sm m-1">
                        View Mode:{" "}
                        {viewMode === "generation"
                            ? "Generation"
                            : viewMode === "graph"
                              ? "Graph"
                              : "Code Analysis"}
                    </div>
                    <ul
                        tabIndex={0}
                        className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
                    >
                        <li onClick={handleChangeViewMode("generation")}>
                            <a>Generation View</a>
                        </li>
                        <li onClick={handleChangeViewMode("graph")}>
                            <a>Graph View</a>
                        </li>
                        <li onClick={handleChangeViewMode("ast")}>
                            <a>Code Analysis View</a>
                        </li>
                    </ul>
                </div>
                {viewMode === "ast" && <AstPageActions />}
            </div>
        </header>
    );
}
