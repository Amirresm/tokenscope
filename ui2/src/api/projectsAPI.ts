import { GenerationToken } from "../store/generationStore";

type ProjectResults = {
    date: string | null;
    passAt1: number | null;
    gtPassRate: number | null;
};

type ProjectInfo = {
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

type Sample = {
    taskId: string;
    tokens: GenerationToken[];
    passed?: boolean;
    details?: Record<string, unknown>;
    tests?: string;
    canonicalSolution?: string;
};

const fetchProjects = async () => {
    try {
        const response = await fetch(
            "http://10.0.0.92:3000/api/fetch_projects",
        );
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        const data = await response.json();
        const projects = data.projects as string[];
        return projects;
    } catch (error) {
        console.error("Error:", error);
    }
};

const getProjectInfo = async ({ projectName }: { projectName: string }) => {
    try {
        const response = await fetch(
            `http://10.0.0.92:3000/api/get_project?project_name=${projectName}`,
        );
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        const data = (await response.json()).project;
        const projectInfo = {
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
        } as ProjectInfo;

        if (data.results) {
            projectInfo.results = {
                date: data.results.date,
                passAt1: data.results.pass_at_1,
                gtPassRate: data.results.gt_pass_rate,
            } as ProjectResults;
        }
        return projectInfo;
    } catch (error) {
        console.error("Error:", error);
    }
};

const getSample = async ({
    projectName,
    taskId,
}: {
    projectName: string;
    taskId: string;
}) => {
    try {
        const response = await fetch(
            `http://10.0.0.92:3000/api/get_sample?project_name=${projectName}&task_id=${taskId}`,
        );
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        const data = await response.json();

        const sample: Sample = {
            taskId: data.sample.task_id,
            details: data.sample.details,
            passed: data.sample.passed,
            tests: data.sample.tests,
            canonicalSolution: data.sample.canonical_solution,
            tokens: data.sample.tokens.map((token: Record<string, any>) => ({
                index: token.index,
                token: token.token,
                tokenId: token.token_id,
                confidence: parseFloat(token.confidence),
                allConfidences: token.all_confidences.map((conf: string) =>
                    parseFloat(conf),
                ),
                allTokensIds: token.all_tokens_ids,
                allTokens: token.all_tokens,
                tags: token.tags,
                stop: token.stop,
                prompt: token.prompt,
                manual: token.manual,
            })),
        };
        return sample;
    } catch (error) {
        console.error("Error:", error);
    }
};

export default {
    fetchProjects,
    getProjectInfo,
    getSample,
};
