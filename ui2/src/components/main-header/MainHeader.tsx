import { useQuery } from "@tanstack/react-query";
import { fetchCurrentModel } from "../../api/llmManagementAPI";
import sessionStore from "../../store/sessionStore";
import { GearIcon, RobotIcon, TreeStructureIcon } from "@phosphor-icons/react";
import { TokenLevelConfigDropdown } from "../TokenLevelConfigDropdown";
import React from "react";
import globalStore from "../../store/components/globalStore";
import astStore, { ViewModesEnum } from "../../store/components/astStore";

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

    const currentModelQuery = useQuery({
        queryKey: ["current-model"],
        queryFn: async () => fetchCurrentModel(),
    });

    const modelName = currentModelQuery.data?.modelNameOrPath
        ? currentModelQuery.data.modelNameOrPath?.split("/")[
              currentModelQuery.data.modelNameOrPath?.split("/").length - 1
          ]
        : "No Model Loaded";

    const handleChangeViewMode = React.useCallback(
        (mode: "generation" | "graph" | "ast") => () => {
            const activeElement = document.activeElement as HTMLElement;
            activeElement?.blur();
            globalStore.viewMode.value = mode;
        },
        [],
    );
    return (
        <header className="">
            <div className="bg-base-200 border border-base-300 rounded-xl flex items-center gap-8 m-4 mb-2 p-2">
                <div className="flex justify-center items-center gap-2">
                    <TreeStructureIcon />
                    <h2 className="">
                        <span className="text-primary">{sessionId}</span> {">"}{" "}
                        <span className="text-primary">{branchId}</span>
                    </h2>
                </div>
                <div className="flex justify-center items-center gap-2">
                    <RobotIcon />
                    <h3 className="">{modelName}</h3>
                </div>
            </div>

            <div className="flex gap-2 items-center mx-4">
                <div className="dropdown">
                    <button
                        className="btn btn-sm"
                        popoverTarget="popover-1"
                        style={{
                            anchorName: "--anchor-1",
                        }}
                    >
                        <GearIcon />
                    </button>
                    <TokenLevelConfigDropdown />
                </div>
                <div className="dropdown">
                    <div tabIndex={0} role="button" className="btn btn-sm m-1">
                        View Mode: {viewMode}
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
