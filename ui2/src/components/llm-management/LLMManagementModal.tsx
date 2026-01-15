import { useMutation, useQuery } from "@tanstack/react-query";
import React from "react";
import { fetchAvailableModels, loadModel } from "../../api/llmManagementAPI";
import { useCurrentModelQuery } from "../../hooks/current-model-query";

function ModelContent() {
    const sources = ["transformers", "openai"];
    const [selectedSource, setSelectedSource] = React.useState(sources[0]);

    const [searchQuery, setSearchQuery] = React.useState("");

    const currentModelQuery = useCurrentModelQuery();

    const availableModelsQuery = useQuery({
        queryKey: ["available-models", selectedSource],
        queryFn: async () => fetchAvailableModels(selectedSource),
        enabled: !!selectedSource,
    });

    const loadModelMutation = useMutation({
        mutationKey: ["load-model"],
        mutationFn: async (model: { id: string; source: string }) =>
            loadModel(model.id, model.source),
        onSuccess: () => {
            currentModelQuery.refetch();
        },
    });

    return (
        <div className="flex flex-col gap-8 min-h-0 flex-1">
            <div>
                <h3 className="mb-2 font-bold text-lg">Current Model</h3>
                {currentModelQuery.isLoading ? (
                    <p>Loading current model...</p>
                ) : currentModelQuery.isError ? (
                    <p>Error loading current model.</p>
                ) : !currentModelQuery.data?.modelNameOrPath ? (
                    <div className="text-sm">No model loaded.</div>
                ) : (
                    <div className="text-sm">
                        Name: {currentModelQuery.data?.modelName} <br />
                        Source: {currentModelQuery.data?.source} <br />
                        Path: {currentModelQuery.data?.modelNameOrPath}
                    </div>
                )}
            </div>
            <div className="flex-1 min-h-0 flex flex-col gap-2">
                <h3 className="font-bold text-lg">Available Models</h3>
                <input
                    type="text"
                    placeholder="Search models..."
                    className="input input-bordered w-full mb-2"
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                    }}
                />
                {/* <div role="tablist" className="tabs tabs-border"> */}
                {/*     {sources.map((source) => ( */}
                {/*         <a */}
                {/*             key={source} */}
                {/*             role="tab" */}
                {/*             className={`tab ${ */}
                {/*                 selectedSource === source ? "tab-active" : "" */}
                {/*             }`} */}
                {/*             onClick={() => setSelectedSource(source)} */}
                {/*         > */}
                {/*             {source} */}
                {/*         </a> */}
                {/*     ))} */}
                {/* </div> */}
                {availableModelsQuery.isLoading ? (
                    <p>Loading models...</p>
                ) : availableModelsQuery.isError ? (
                    <p>Error loading models.</p>
                ) : (
                    <ul className="list bg-base-100 rounded-box shadow-md min-h-0 overflow-y-auto flex-1">
                        {availableModelsQuery.data
                            ?.filter((model) =>
                                model.id
                                    .toLowerCase()
                                    .includes(searchQuery.toLowerCase()),
                            )
                            ?.map((model) => (
                                <li key={model.id} className="list-row">
                                    <h4 className="list-col-grow">
                                        {model.id}
                                    </h4>
                                    <button
                                        className={`btn btn-sm btn-ghost btn-secondary ${
                                            loadModelMutation.isPending
                                                ? "btn-disabled"
                                                : ""
                                        }`}
                                        onClick={() =>
                                            loadModelMutation.mutate({
                                                id: model.id,
                                                source: selectedSource,
                                            })
                                        }
                                    >
                                        {loadModelMutation.isPending
                                            ? "...."
                                            : "Load"}
                                    </button>
                                </li>
                            ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export function LLMManagementModal() {
    return (
        <dialog id="llm_management_modal" className="modal">
            <div className="modal-box h-[90vh] flex">
                <ModelContent />
            </div>
            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    );
}
