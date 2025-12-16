import { computed, signal } from "@preact/signals-react";

type DrawerTab = "session" | "generation" | "stats" | "projects" | null;

type DrawerState = {
    open: boolean;
    tab: DrawerTab;
};

const drawerStateSignal = signal<DrawerState>({
    open: false,
    tab: "generation",
});

const drawerOpenSignal = computed(() => drawerStateSignal.value.open);

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

export function setDrawerTab(tab: DrawerTab) {
    drawerStateSignal.value = {
        ...drawerStateSignal.value,
        tab,
    };
}

export default {
    drawerStateSignal,
    drawerOpenSignal,
    toggleDrawer,
    closeDrawer,
    openDrawer,
    setDrawerTab,
};
