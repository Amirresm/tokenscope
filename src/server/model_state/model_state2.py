from dataclasses import dataclass
import json
import threading
from typing import Awaitable, Callable
import asyncio


from src.ast_service.ast_service import ASTService
from src.generator.client.gen_client import GenClient
from src.generator.token_node import GenerationTree, Token, TokenNode
from src.model.wrapper import (
    ControlTokenTypes,
    LlamaModelWrapper,
    QwenModelWrapper,
)
from src.generator.gen import Generator


@dataclass
class Session:
    session_id: str
    generation_tree: GenerationTree


class ModelState:
    def __init__(self, model_path: str) -> None:
        self.generate_lock = threading.Lock()
        # Wrapper = (
        #     LlamaModelWrapper
        #     if "llama" in model_path.lower()
        #     else QwenModelWrapper if "qwen" in model_path.lower() else None
        # )
        # assert Wrapper is not None, f"Unsupported model: {model_path}"
        # wrapper = Wrapper(model_path, q4bit=False)

        # self.generator = Generator(
        #     wrapper,
        #     stop_tokens=[ControlTokenTypes.EOS],
        #     topk=5,
        #     force_greedy=True,
        # )

        # self.batch_generator = BatchGenerator(
        #     wrapper,
        #     stop_tokens=[ControlTokenTypes.EOS],
        #     topk=5,
        #     force_greedy=True,
        # )

        # available_models = OpenAIGenerator.get_available_models()
        # model_info = [m for m in available_models if "llama-3.1" in m["id"]][0]
        # self.batch_generator = OpenAIGenerator(
        #     model_name=model_info["id"],
        #     model_hf_id=model_info["hugging_face_id"],
        # )

        self.batch_generator = GenClient()

        self.ast_service = ASTService()

        self.sessions: dict[str, Session] = {}
        self.session_counter = 0
        self.branch_counter = 0

    def get_sessions(self) -> dict[str, Session]:
        return self.sessions

    def get_session_branches(self, session_id: str) -> set[str]:
        session = self.sessions.get(session_id, None)
        if session is None:
            raise ValueError(f"Session {session_id} not found")
        return session.generation_tree.branch_ids

    async def prefill_generation(
        self,
        session_id: str,
        branch_id: str,
    ):
        session = self.sessions.get(session_id, None)
        if session is None:
            raise ValueError(f"Session {session_id} not found")

        if branch_id not in session.generation_tree.branch_ids:
            raise ValueError(
                f"Branch {branch_id} not found in session {session_id}"
            )

        data = {
            "type": "session_info",
            "content": {
                "session_id": session_id,
                "branch_id": branch_id,
            },
        }
        data = json.dumps(data)
        data += "\n"
        yield data
        await asyncio.sleep(0)

        print("Prefilling generation ...")
        for token_node in session.generation_tree.get_token_list(branch_id):
            token_dict = token_node.to_dict()
            data = {
                "type": "token",
                "content": token_dict,
            }
            data = json.dumps(data)
            data.replace("\n", "\\n")
            data += "\n"
            yield data
            await asyncio.sleep(0)

    def get_ast(
        self,
        session_id: str,
        branch_id: str,
        character_start: int,
        character_end: int,
    ):
        session = self.sessions.get(session_id, None)
        if session is None:
            raise ValueError(f"Session {session_id} not found")

        if branch_id not in session.generation_tree.branch_ids:
            raise ValueError(
                f"Branch {branch_id} not found in session {session_id}"
            )

        token_list = session.generation_tree.get_token_list(branch_id)
        filtered_token_list: list[Token] = []
        currrent_character_pos = 0
        for t in token_list:
            token_text = t.token.token_string
            token_length = len(token_text)
            token_end_pos = currrent_character_pos + token_length
            if token_end_pos < character_start:
                currrent_character_pos += token_length
                continue
            if currrent_character_pos > character_end:
                break
            filtered_token_list.append(t.token)
            currrent_character_pos += token_length

        filtered_token_list = [
            t for t in filtered_token_list if "special" not in t.token_types
        ]

        token_info_list, blocks, atomic_blocks = (
            self.ast_service.map_ast_to_tokens(filtered_token_list)
        )

        for ti in token_info_list:
            ti.token.alternative_tokens = []

        tokens_json = [
            {
                "token": t.token,
                "match": t.prominent_match,
                "block_id": t.block.id if t.block else None,
                "block_type": t.block.type if t.block else None,
                "block_depth": t.block.depth if t.block else None,
                "atomic_block": t.atomic_block,
                "start": t.start,
                "end": t.end,
                "line_number": t.line_number,
            }
            for t in token_info_list
        ]

        blocks_json = [
            {
                "id": b.id,
                "parent_id": b.parent_id,
                "type": b.type,
                "total_range": b.total_range,
                "unique_ranges": b.unique_ranges,
                "depth": b.depth,
                "source": b.source,
                "unique_sources": b.unique_sources,
            }
            for b in blocks
        ]

        atomic_blocks_json = [
            {
                "id": ab.id,
                "type": ab.type,
                "depth": ab.depth,
                "range": ab.range,
                "source": ab.source,
            }
            for ab in atomic_blocks
        ]
        return {
            "tokens": tokens_json,
            "blocks": blocks_json,
            "atomic_blocks": atomic_blocks_json,
        }

    async def generate_new(
        self,
        prompt: str,
        max_tokens: int,
        branch_id: str | None = None,
        should_stop: Callable[[], Awaitable[bool]] | None = None,
    ):
        session_id = f"session_{self.session_counter}"
        self.session_counter += 1
        session = Session(
            session_id=session_id,
            generation_tree=GenerationTree(),
        )
        self.sessions[session_id] = session

        branch_id = f"branch_{self.branch_counter}"
        self.branch_counter += 1

        data = {
            "type": "session_info",
            "content": {
                "session_id": session_id,
                "branch_id": branch_id,
            },
        }
        data = json.dumps(data)
        data += "\n"
        yield data
        await asyncio.sleep(0)

        print("Waiting for model lock ...")
        with self.generate_lock:
            print("Starting generation ...")
            # self.batch_generator.reset()
            for batch in self.batch_generator.generate_yield(
                prompt,
                max_tokens=max_tokens,
                log_metric=True,
                record_attention=True,
            ):
                step = batch[0]
                print(step.token.token_string, end="")
                if should_stop and await should_stop():
                    print("Stopping generation ...")
                    break
                token_node = TokenNode(
                    token=step.token,
                    branch_id=branch_id,
                )
                session.generation_tree.add_token(token_node)

                token_dict = token_node.to_dict()
                data = {
                    "type": "token",
                    "content": token_dict,
                }
                data = json.dumps(data)
                data.replace("\n", "\\n")
                data += "\n"
                yield data
                await asyncio.sleep(0)
                if step.stop:
                    print("Reaching end...")
                    break

    async def continue_generate(
        self,
        session_id: str,
        branch_id: str,
        branch_position: int,
        appended_prompt: str,
        max_tokens: int,
        resume_old_branch: bool = False,
        should_stop: Callable[[], Awaitable[bool]] | None = None,
    ):
        if session_id is None:
            session_id = f"session_{self.session_counter -1}"
        if branch_id is None:
            branch_id = f"branch_{self.branch_counter-1}"
        session = self.sessions.get(session_id, None)
        if session is None:
            raise ValueError(f"Session {session_id} not found")
        if branch_id not in session.generation_tree.branch_ids:
            raise ValueError(
                f"Branch {branch_id} not found in session {session_id}"
            )

        data = {
            "type": "session_info",
            "content": {
                "session_id": session_id,
                "branch_id": branch_id,
            },
        }

        data = json.dumps(data)
        data += "\n"
        yield data
        await asyncio.sleep(0)
        new_branch_created = False
        if resume_old_branch:
            new_branch_id = branch_id
            prompt = session.generation_tree.get_token_list(branch_id)
        else:
            new_branch_id = f"branch_{self.branch_counter}"
            self.branch_counter += 1
            print(f"branch_position: {branch_position}")
            if appended_prompt:
                tokens = self.batch_generator.prompts_to_token(
                    [appended_prompt]
                )
                tokens = tokens[0]
                print(
                    f"Appending prompt tokens: {[t.token_string for t in tokens]}"
                )
                session.generation_tree.create_new_branch(
                    TokenNode(
                        token=tokens[0],
                        branch_id=new_branch_id,
                    ),
                    starting_branch_id=branch_id,
                    branch_position=branch_position - 1,
                )
                for token in tokens[1:]:
                    session.generation_tree.add_token(
                        TokenNode(
                            token=token,
                            branch_id=new_branch_id,
                        )
                    )
                new_branch_created = True
                prompt = session.generation_tree.get_token_list(new_branch_id)
            else:
                prompt = session.generation_tree.get_token_list(branch_id)
                prompt = prompt[:branch_position]

        for token_node in prompt:
            token_dict = token_node.to_dict()
            data = {
                "type": "token",
                "content": token_dict,
            }
            data = json.dumps(data)
            data.replace("\n", "\\n")
            data += "\n"
            yield data
            await asyncio.sleep(0)

        prompt = [[t.token for t in prompt]]

        print("Waiting for model lock ...")
        with self.generate_lock:
            print("Starting generation ...")
            # self.batch_generator.reset()
            for batch in self.batch_generator.generate_yield(
                "",  # ignored
                prompts_tokens=prompt,
                max_tokens=max_tokens,
                log_metric=True,
                record_attention=True,
            ):
                step = batch[0]
                if not step.fresh:
                    continue
                if should_stop and await should_stop():
                    print("Stopping generation ...")
                    break

                token_node = TokenNode(
                    token=step.token, branch_id=new_branch_id
                )

                if not new_branch_created and not resume_old_branch:
                    session.generation_tree.create_new_branch(
                        token_node,
                        starting_branch_id=branch_id,
                        branch_position=branch_position - 1,
                    )
                    new_branch_created = True
                else:
                    session.generation_tree.add_token(token_node)

                token_dict = token_node.to_dict()
                data = {
                    "type": "token",
                    "content": token_dict,
                }
                data = json.dumps(data)
                data.replace("\n", "\\n")
                data += "\n"
                yield data
                await asyncio.sleep(0)
                if step.stop:
                    print("Reaching end...")
                    break
