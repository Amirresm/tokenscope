import { signal } from "@preact/signals-react";

export enum DrawerTabsEnum {
    SESSION = "session",
    GENERATION = "generation",
    ATTENTION = "attention",
    STATS = "stats",
    PROJECTS = "projects",

    ASTSTATS = "ASTStats",
}

type DrawerState = {
    open: boolean;
    tab: DrawerTabsEnum;
};

const drawerStateSignal = signal<DrawerState>({
    open: false,
    tab: DrawerTabsEnum.SESSION,
});

function toggleDrawer() {
    drawerStateSignal.value = {
        ...drawerStateSignal.value,
        open: !drawerStateSignal.value.open,
    };
}

function closeDrawer() {
    drawerStateSignal.value = {
        ...drawerStateSignal.value,
        open: false,
    };
}

function openDrawer() {
    drawerStateSignal.value = {
        ...drawerStateSignal.value,
        open: true,
    };
}

function tokenClickDrawer() {
    if ([DrawerTabsEnum.GENERATION, DrawerTabsEnum.ATTENTION].includes(drawerStateSignal.value.tab)) {
        openDrawer();
    } else {
        drawerStateSignal.value = {
            ...drawerStateSignal.value,
            tab: DrawerTabsEnum.GENERATION,
            open: true,
        };
    }
}

function setDrawerTab(tab: DrawerTabsEnum) {
    drawerStateSignal.value = {
        ...drawerStateSignal.value,
        tab,
    };
}

export default {
    drawerStateSignal,
    toggleDrawer,
    closeDrawer,
    openDrawer,
    tokenClickDrawer,
    setDrawerTab,
};
