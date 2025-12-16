import { ChartBar, Folder, List, User } from "@phosphor-icons/react";
import { LandingPage } from "./components/page/Landing";
import { Sidebar } from "./components/sidebar/Sidebar";
import drawerStore from "./store/drawerStore";
import React from "react";

function App() {
    const drawerOpen = drawerStore.drawerOpenSignal.value;
    const drawerState = drawerStore.drawerStateSignal.value;

    const handleToggleSessionDrawer = React.useCallback(() => {
        if (drawerOpen && drawerState.tab === "session") {
            drawerStore.closeDrawer();
        } else {
            drawerStore.setDrawerTab("session");
            drawerStore.openDrawer();
        }
    }, [drawerOpen, drawerState]);

    const handleToggleGenerationDrawer = React.useCallback(() => {
        if (drawerOpen && drawerState.tab === "generation") {
            drawerStore.closeDrawer();
        } else {
            drawerStore.setDrawerTab("generation");
            drawerStore.openDrawer();
        }
    }, [drawerOpen, drawerState]);

    const handleToggleStatsDrawer = React.useCallback(() => {
        if (drawerOpen && drawerState.tab === "stats") {
            drawerStore.closeDrawer();
        } else {
            drawerStore.setDrawerTab("stats");
            drawerStore.openDrawer();
        }
    }, [drawerOpen, drawerState.tab]);

    const handleToggleProjectsDrawer = React.useCallback(() => {
        if (drawerOpen && drawerState.tab === "projects") {
            drawerStore.closeDrawer();
        } else {
            drawerStore.setDrawerTab("projects");
            drawerStore.openDrawer();
        }
    }, [drawerOpen, drawerState.tab]);

    return (
        <div className={`drawer drawer-end ${drawerOpen ? "drawer-open" : ""}`}>
            <input
                id="my-drawer"
                type="checkbox"
                className="group drawer-toggle"
                checked={drawerOpen}
            />
            <div className="drawer-content transition-all h-screen mr-4 flex">
                <div className="grow">
                    <LandingPage />
                </div>
                <div className="flex flex-col items-center gap-2 my-4">
                    <button
                        className={`btn btn-ghost btn-sm btn-square ${drawerState.tab === "session" ? "btn-active" : ""}`}
                        onClick={handleToggleSessionDrawer}
                    >
                        <User />
                    </button>
                    <button
                        className={`btn btn-ghost btn-sm btn-square ${drawerState.tab === "generation" ? "btn-active" : ""}`}
                        onClick={handleToggleGenerationDrawer}
                    >
                        <List />
                    </button>
                    <button
                        className={`btn btn-ghost btn-sm btn-square ${drawerState.tab === "stats" ? "btn-active" : ""}`}
                        onClick={handleToggleStatsDrawer}
                    >
                        <ChartBar />
                    </button>
                    <button
                        className={`btn btn-ghost btn-sm btn-square ${drawerState.tab === "projects" ? "btn-active" : ""}`}
                        onClick={handleToggleProjectsDrawer}
                    >
                        <Folder />
                    </button>
                    <div className="divider divider-horizontal mx-0 grow self-center"></div>
                </div>
            </div>
            <div className="drawer-side">
                <label
                    htmlFor="my-drawer"
                    aria-label="close sidebar"
                    className="drawer-overlay"
                ></label>
                <Sidebar />
            </div>
        </div>
    );
}

export default App;
