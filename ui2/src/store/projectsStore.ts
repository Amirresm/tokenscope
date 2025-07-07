import { signal } from "@preact/signals-react";

const selectedProject = signal<string | null>(null);

const selectedSampleInfo = signal<{
    taskId: string;
    passed?: boolean;
    details?: Record<string, unknown>;
	tests?: string;
	canonicalSolution?: string;
} | null>(null);

export default {
    selectedProject: selectedProject,
    selectedSampleInfo: selectedSampleInfo,
};
