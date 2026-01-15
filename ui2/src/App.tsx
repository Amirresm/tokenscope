import {
    ChartBarIcon,
    ChartLineIcon,
    FolderIcon,
    GraphIcon,
    ListIcon,
    UserIcon,
} from "@phosphor-icons/react";
import { LandingPage } from "./components/page/Landing";
import { Sidebar } from "./components/sidebar/Sidebar";
import React from "react";
import drawerStore, { DrawerTabsEnum } from "./store/components/drawerStore";
import { LLMManagementModal } from "./components/llm-management/LLMManagementModal";
import { TrendChartModal } from "./components/reports/TrendChart";
import { MainBar } from "./components/main-bar/MainBar";
import { PromptModal } from "./components/reports/PromptModal";
import globalStore from "./store/components/globalStore";
import { ASTStatsChartModal } from "./components/reports/AstStatsChart";
import { ASTAttentionHeatmapModal } from "./components/reports/AstAttentionHeatmap";

const genTabs = [
    { tab: DrawerTabsEnum.SESSION, icon: UserIcon, label: "Session" },
    { tab: DrawerTabsEnum.STATS, icon: ChartLineIcon, label: "Stats" },
    { tab: DrawerTabsEnum.GENERATION, icon: ListIcon, label: "Generation" },
    { tab: DrawerTabsEnum.ATTENTION, icon: GraphIcon, label: "Attention" },
    // { tab: DrawerTabsEnum.PROJECTS, icon: FolderIcon, label: "Projects" },
];
const astTabs = [
    { tab: DrawerTabsEnum.SESSION, icon: UserIcon, label: "Session" },
    { tab: DrawerTabsEnum.ASTSTATS, icon: ChartLineIcon, label: "AST Stats" },
];

function App() {
    const drawerState = drawerStore.drawerStateSignal.value;
    const drawerOpen = drawerState.open;

    const handleToggleDrawer = React.useCallback(
        (tab: DrawerTabsEnum) => {
            if (drawerOpen && drawerState.tab === tab) {
                drawerStore.closeDrawer();
            } else {
                drawerStore.setDrawerTab(tab);
                drawerStore.openDrawer();
            }
        },
        [drawerOpen, drawerState],
    );

    const tabs = globalStore.viewMode.value === "ast" ? astTabs : genTabs;

    return (
        <div className={`drawer drawer-end ${drawerOpen ? "drawer-open" : ""}`}>
            <input
                id="my-drawer"
                type="checkbox"
                className="drawer-toggle"
                checked={drawerOpen}
                onChange={() => {}}
            />
            <div className="drawer-content transition-all h-screen mx-4 flex">
                <MainBar />
                <div className="grow min-w-0">
                    <LLMManagementModal />
                    <TrendChartModal />
                    <ASTStatsChartModal />
                    <ASTAttentionHeatmapModal />
                    <PromptModal />
                    <LandingPage />
                </div>
                <div className="flex flex-col items-center gap-2 my-4">
                    {tabs.map(({ tab, icon: Icon, label }) => (
                        <div
                            className="tooltip tooltip-left"
                            data-tip={label}
                            key={tab}
                        >
                            <button
                                className={`btn btn-ghost btn-sm btn-square ${
                                    drawerState.tab === tab ? "btn-active" : ""
                                }`}
                                onClick={() => handleToggleDrawer(tab)}
                            >
                                <Icon />
                            </button>
                        </div>
                    ))}
                    <div className="divider divider-horizontal mx-0 grow self-center"></div>
                </div>
            </div>
            <div className="drawer-side">
                <label
                    htmlFor="my-drawer"
                    aria-label="close sidebar"
                    className="drawer-overlay"
                ></label>
                <div className="h-full translate-x-96 is-drawer-open:translate-x-0 transition-transform duration-75">
                    <Sidebar />
                </div>
            </div>
        </div>
    );
}

export default App;
