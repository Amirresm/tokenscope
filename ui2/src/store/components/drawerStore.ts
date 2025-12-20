import { signal } from "@preact/signals-react";

export enum DrawerTabsEnum {
    SESSION = "session",
    GENERATION = "generation",
    STATS = "stats",
    PROJECTS = "projects",
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

export function setDrawerTab(tab: DrawerTabsEnum) {
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
    setDrawerTab,
};
