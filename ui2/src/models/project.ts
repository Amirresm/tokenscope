import {
    GenerationToken,
    GenerationTokenData,
    generationTokenFromData,
} from "./generationToken";

export type ProjectResults = {
    date: string | null;
    passAt1: number | null;
    gtPassRate: number | null;
};

export type ProjectInfo = {
    name: string;
    samplesCount: number;
    hasResults: boolean;
    samples: { id: string; p?: boolean }[];
    modelName: string;
    modelPath: string;
    projectPath: string;
    instructionPrefix: string;
    responsePrefix: string;
    idRange: string;
    nSamples: number;
    split: string;
    subset: string;
    results?: ProjectResults;
};

export type Sample = {
    taskId: string;
    tokens: GenerationToken[];
    passed?: boolean;
    details?: Record<string, unknown>;
    tests?: string;
    canonicalSolution?: string;
};

export function projectInfoFromData(data: Record<string, any>): ProjectInfo {
    const projectInfo: ProjectInfo = {
        name: data.name,
        samplesCount: data.samples_count,
        hasResults: data.has_results,
        samples: data.samples,
        modelName: data.model_name,
        modelPath: data.model_path,
        projectPath: data.project_path,
        instructionPrefix: data.instruction_prefix,
        responsePrefix: data.response_prefix,
        idRange: data.id_range,
        nSamples: data.n_samples,
        split: data.split,
        subset: data.subset,
    };

    if (data.results) {
        projectInfo.results = {
            date: data.results.date,
            passAt1: data.results.pass_at_1,
            gtPassRate: data.results.gt_pass_rate,
        };
    }
    return projectInfo;
}

export function sampleFromData(data: Record<string, any>): Sample {
    const tokens = data.tokens.map((token: GenerationTokenData) =>
        generationTokenFromData(token),
    );
    const sample: Sample = {
        taskId: data.task_id,
        details: data.details,
        passed: data.passed,
        tests: data.tests,
        canonicalSolution: data.canonical_solution,
        tokens,
    };
    return sample;
}
