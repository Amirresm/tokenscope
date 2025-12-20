import { signal } from "@preact/signals-react";

const sessionId = signal<string | null>(null);
const setSessionId = (id: string) => {
    sessionId.value = id;
};
const branchId = signal<string | null>(null);
const setBranchId = (id: string | null) => {
    branchId.value = id;
};

export default {
    sessionId,
    setSessionId,
    branchId,
    setBranchId,
}
