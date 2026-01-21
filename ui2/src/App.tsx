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
import { RelativeAttentionModal } from "./components/reports/RelativeAttentionChart";
import { ReverseAttentionModal } from "./components/reports/ReverseAttentionChart";

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
        <div className="flex mx-1 gap-1">
            <MainBar />
            <div className="grow min-w-0">
                <LLMManagementModal />
                <TrendChartModal />
                <RelativeAttentionModal />
                <ReverseAttentionModal />
                <ASTStatsChartModal />
                <ASTAttentionHeatmapModal />
                <PromptModal />
                <LandingPage />
            </div>
            <div className="sticky top-0 h-screen flex z-10">
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
                {drawerOpen && <Sidebar />}
            </div>
        </div>
    );
}

export default App;
