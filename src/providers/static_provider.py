import os
import json

from dataclasses import dataclass
from src.generator.gen import StepResult
from src.utils.jsonl import stream_jsonl


@dataclass
class Sample:
    task_id: str
    tokens: list[StepResult]
    passed: bool | None = None
    details: dict | None = None
    tests: str | None = None
    canonical_solution: str | None = None


@dataclass
class ProjectResults:
    date: str | None = None
    pass_at_1: float | None = None
    gt_pass_rate: float | None = None


@dataclass
class Project:
    name: str
    samples: dict[str, Sample]

    model_name: str | None = None
    model_path: str | None = None
    project_path: str | None = None
    instruction_prefix: str | None = None
    response_prefix: str | None = None
    id_range: str | None = None
    n_samples: int | None = None

    split: str | None = None
    subset: str | None = None
    has_results: bool = False
    results: ProjectResults | None = None


class StaticProvider:
    def __init__(self, root_dir: str):
        self.root_dir = root_dir
        self.projects = {}

    def get_project_names(self) -> list[str]:
        directories = [
            f
            for f in os.listdir(self.root_dir)
            if os.path.isdir(os.path.join(self.root_dir, f))
        ]

        return directories

    def load_project(self, project_name: str):
        project_dir = os.path.join(self.root_dir, project_name)

        if not os.path.exists(project_dir):
            raise FileNotFoundError(f"Project {project_name} not found.")

        metadata_path = os.path.join(project_dir, "metadata.json")
        full_generation_path = os.path.join(
            project_dir, "full_generation.jsonl"
        )
        dataset_info_path = os.path.join(project_dir, "dataset_rows.jsonl")
        full_results_path = os.path.join(
            project_dir, f"samples_eval_results.json"
        )
        results_summary_path = os.path.join(
            project_dir, f"samples_pass_at_k.json"
        )

        if not os.path.exists(full_generation_path):
            raise FileNotFoundError(
                f"Full generation file not found for project {project_name}."
            )

        samples = {}
        for data in stream_jsonl(full_generation_path):
            task_id = data.get("task_id")
            assert task_id is not None, "task_id is required in the data"
            tokens = [
                StepResult.from_json(step) for step in data.get("tokens", [])
            ]
            sample = Sample(
                task_id=task_id,
                tokens=tokens,
            )
            samples[task_id] = sample

        project = Project(name=project_name, samples=samples)

        if os.path.exists(metadata_path):
            with open(metadata_path, "r") as f:
                metadata = json.load(f)
                project.model_name = metadata.get("model_name")
                project.model_path = metadata.get("model_path")
                project.project_path = metadata.get("project_path")
                project.split = metadata.get("split")
                project.subset = metadata.get("subset")
                project.instruction_prefix = metadata.get("instruction_prefix")
                project.response_prefix = metadata.get("response_prefix")
                project.id_range = metadata.get("id_range")
                project.n_samples = metadata.get("n_samples")

        if os.path.exists(dataset_info_path):
            for data in stream_jsonl(dataset_info_path):
                task_id = data.get("id")
                assert task_id is not None, "task_id is required in the data"
                sample = samples.get(task_id)
                if sample is not None:
                    sample.tests = data.get("test")
                    sample.canonical_solution = data.get("canonical_solution")

        if os.path.exists(full_results_path) and os.path.exists(
            results_summary_path
        ):
            project.has_results = True
            with open(full_results_path, "r") as f:
                full_results = json.load(f)
                date = full_results.get("date")
                results = full_results.get("eval")
                for k, v in results.items():
                    first_item = v[0]
                    status = first_item.get("status")
                    details = first_item.get("details")
                    project.samples[k].passed = status == "pass"
                    project.samples[k].details = details

            with open(results_summary_path, "r") as f:
                results_summary = json.load(f)
                pass_at_1 = results_summary.get("pass@1")
                gt_pass_rate = results_summary.get("gt_pass_rate")
                if pass_at_1 is None or gt_pass_rate is None:
                    raise ValueError(
                        "pass_at_1 and gt_pass_rate are required in the results summary."
                    )

                project.results = ProjectResults(
                    date=date, pass_at_1=pass_at_1, gt_pass_rate=gt_pass_rate
                )
                project.has_results = True

        self.projects[project_name] = project

    def get_project_info(self, project_name: str) -> dict:
        if project_name not in self.projects:
            self.load_project(project_name)

        project = self.projects[project_name]
        sample_info = [
            {"id": sample.task_id, "p": sample.passed}
            for sample in project.samples.values()
        ]
        info = {
            "name": project.name,
            "samples_count": len(project.samples),
            "samples": sample_info,
            "model_name": project.model_name,
            "model_path": project.model_path,
            "project_path": project.project_path,
            "instruction_prefix": project.instruction_prefix,
            "response_prefix": project.response_prefix,
            "id_range": project.id_range,
            "n_samples": project.n_samples,
            "split": project.split,
            "subset": project.subset,
            "has_results": project.has_results,
            "results": project.results,
        }

        return info

    def get_sample(self, project_name: str, task_id: str) -> dict:
        if project_name not in self.projects:
            self.load_project(project_name)

        project = self.projects[project_name]
        sample = project.samples.get(task_id)

        if sample is None:
            raise ValueError(
                f"Sample {task_id} not found in project {project_name}."
            )

        return {
            "task_id": sample.task_id,
            "tokens": [step.to_json() for step in sample.tokens],
            "passed": sample.passed,
            "details": sample.details,
            "tests": sample.tests,
            "canonical_solution": sample.canonical_solution,
        }
