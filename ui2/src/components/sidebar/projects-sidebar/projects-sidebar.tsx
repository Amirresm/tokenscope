import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeftIcon,
    CheckIcon,
    XIcon,
} from "@phosphor-icons/react";
import generationStore from "../../../store/generationStore";
import projectsStore from "../../../store/projectsStore";
import { fetchProjectInfo, fetchProjects, fetchSample } from "../../../api/projectsAPI";

type ProjectInfoPageProps = {
    projectName: string;
};

const ProjectInfoPage = ({ projectName }: ProjectInfoPageProps) => {
    const sampleInfo = projectsStore.selectedSampleInfo.value;

    const projectInfoQuery = useQuery({
        queryKey: ["projectInfo", projectName],
        queryFn: () => fetchProjectInfo(projectName),
    });

    const appendToGeneration = generationStore.appendToGeneration;
    const clearGeneration = generationStore.clearGeneration;

    const handleClick = React.useCallback(
        async (sampleId: string) => {
            const sample = await fetchSample(projectName, sampleId);
            if (!sample) {
                return;
            }
            clearGeneration();

            projectsStore.selectedSampleInfo.value = {
                taskId: sample.taskId,
                passed: sample.passed,
                details: sample.details,
                tests: sample.tests,
                canonicalSolution: sample.canonicalSolution,
                tokens: sample.tokens,
            };

            const tokens = sample.tokens;

            for (const token of tokens) {
                appendToGeneration(token);
            }
        },
        [appendToGeneration, clearGeneration, projectName],
    );

    console.log(sampleInfo);
    return projectInfoQuery.isLoading || !projectInfoQuery.data ? (
        <div className="loading">
            <p>Loading...</p>
        </div>
    ) : (
        <div className="flex flex-col gap-2 mt-2 h-full">
            <h2>Model: {projectInfoQuery.data.modelName}</h2>
            <h2>
                Dataset: {projectInfoQuery.data.subset} -{" "}
                {projectInfoQuery.data.split}
            </h2>
            <div className="border border-base-300 rounded-field p-4">
                {projectInfoQuery.data.results ? (
                    <>
                        <div>{projectInfoQuery.data.results.date}</div>
                        <div>
                            Pass rate:{" "}
                            {(
                                (projectInfoQuery.data.results.passAt1 || 0) *
                                100
                            ).toFixed(2)}
                        </div>
                    </>
                ) : (
                    <div className="">No results yet</div>
                )}
            </div>
            <div className="collapse collapse-arrow bg-base-100 border-base-300 border rounded-field">
                <input type="checkbox" />
                <div className="collapse-title">
                    {projectInfoQuery.data.samplesCount} samples
                </div>
                <div className="collapse-content text-sm">
                    <div className="menu rounded-box w-full max-h-80 overflow-y-auto flex-nowrap">
                        {projectInfoQuery.data.samples.map?.((sample) => (
                            <li
                                key={sample.id}
                                onClick={() => handleClick(sample.id)}
                            >
                                <a>
                                    {sample.p === true ? (
                                        <CheckIcon size={16} color="green" />
                                    ) : sample.p === false ? (
                                        <XIcon size={16} color="red" />
                                    ) : null}{" "}
                                    {sample.id}
                                </a>
                            </li>
                        ))}
                    </div>
                </div>
            </div>
            <button
                className="btn"
                onClick={() =>
                    document.getElementById("solution-modal")?.showModal()
                }
            >
                open modal
            </button>
            <dialog id="solution-modal" className="modal">
                <div className="modal-box w-10/12 max-w-11/12">
                    <h3 className="font-bold text-lg">Canonical Solution</h3>
                    <p className="py-4 whitespace-break-spaces">
                        {sampleInfo?.canonicalSolution}
                    </p>
                    <div className="divider"></div>
                    <h3 className="font-bold text-lg">Tests</h3>
                    <p className="py-4 whitespace-break-spaces">
                        {sampleInfo?.tests}
                    </p>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
            <div className="grow min-h-0 overflow-y-auto">
                <div className="border border-base-300 rounded-field p-4">
                    {sampleInfo ? (
                        <>
                            <h2 className="flex gap-1 items-center">
                                {"Sample: "}
                                {sampleInfo.passed === true ? (
                                    <CheckIcon
                                        size={24}
                                        color="green"
                                        className="inline-block"
                                    />
                                ) : sampleInfo.passed === false ? (
                                    <XIcon
                                        size={24}
                                        color="red"
                                        className="inline-block"
                                    />
                                ) : null}
                                {sampleInfo.taskId}
                            </h2>
                            {sampleInfo.details &&
                                Object.entries(sampleInfo.details).map(
                                    ([key, value]) => (
                                        <div key={key} className="mb-2">
                                            <h3 className="font-semibold">
                                                {key}
                                            </h3>
                                            <p className="text-xs whitespace-break-spaces">
                                                {JSON.stringify(value).replace(
                                                    /\\n/g,
                                                    "\n",
                                                )}
                                            </p>
                                        </div>
                                    ),
                                )}
                        </>
                    ) : (
                        <div className="">No sample selected</div>
                    )}
                </div>
            </div>
        </div>
    );
};

type ProjectListPageProps = {
    onSelect: (projectName: string) => void;
};
const ProjectListPage = ({ onSelect }: ProjectListPageProps) => {
    const projectQuery = useQuery({
        queryKey: ["projects"],
        queryFn: fetchProjects,
    });

    return (
        <div className="menu rounded-box w-full">
            {projectQuery.isLoading || !projectQuery.data ? (
                <div className="loading">
                    <p>Loading...</p>
                </div>
            ) : (
                projectQuery.data.map?.((projectName) => (
                    <li onClick={() => onSelect(projectName)} key={projectName}>
                        <a>{projectName}</a>
                    </li>
                ))
            )}
        </div>
    );
};

const ProjectSidebar = () => {
    const selectedProject = projectsStore.selectedProject.value;

    const handleSelectProject = React.useCallback((projectName: string) => {
        projectsStore.selectedProject.value = projectName;
    }, []);

    return (
        <div className="w-full h-full flex flex-col">
            {selectedProject ? (
                <div className="flex items-center gap-2">
                    <button
                        className="btn btn-sm btn-square btn-ghost"
                        onClick={() =>
                            (projectsStore.selectedProject.value = null)
                        }
                    >
                        <ArrowLeftIcon size={24} />
                    </button>
                    <h2 className="text-xl font-bold">{selectedProject}</h2>
                </div>
            ) : (
                <h2 className="text-2xl font-bold">Select a Project</h2>
            )}
            <div className="w-full grow">
                {selectedProject ? (
                    <ProjectInfoPage projectName={selectedProject} />
                ) : (
                    <ProjectListPage onSelect={handleSelectProject} />
                )}
            </div>
        </div>
    );
};

export default ProjectSidebar;
