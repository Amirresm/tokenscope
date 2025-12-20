import { signal } from "@preact/signals-react";
import { Sample } from "../models/project";

const selectedProject = signal<string | null>(null);

const selectedSampleInfo = signal<Sample | null>(null);

export default {
    selectedProject,
    selectedSampleInfo,
};
