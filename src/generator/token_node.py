from dataclasses import dataclass, field
import enum
import json


class TokenType(enum.Enum):
    PROMPT = "prompt"
    MANUAL = "manual"

    SPECIAL = "special"
    FIM = "fim"
    STOP = "stop"


@dataclass
class Token:
    token_string: str
    token_id: int
    confidence: float
    position: int  # or depth

    # token_types: set[TokenType]
    token_types: list[str]
    alternative_tokens: list["Token"] = field(default_factory=list)
    attention_snapshot: dict[str, list[tuple[int, float]]] | None = None

    def to_dict(self) -> dict:
        data = {
            "token_string": self.token_string,
            "token_id": self.token_id,
            "confidence": self.confidence,
            "position": self.position,
            "token_types": [t for t in self.token_types],
            "alternative_tokens": [
                alt_token.to_dict() for alt_token in self.alternative_tokens
            ],
            "attention_snapshot": self.attention_snapshot,
        }
        return data

    @staticmethod
    def from_dict(data: dict) -> "Token":
        alternative_tokens = [
            Token.from_dict(alt_token_data)
            for alt_token_data in data.get("alternative_tokens", [])
        ]
        attention_snapshot: dict[str, list[tuple[int, float]]] | None = None
        if "attention_snapshot" in data and data["attention_snapshot"] is not None:
            attention_snapshot = {}
            for key, value in data["attention_snapshot"].items():
                attention_snapshot[key] = []
                for a in value:
                    attention_snapshot[key].append((a[0], a[1]))

        token = Token(
            token_string=data["token_string"],
            token_id=data["token_id"],
            confidence=data["confidence"],
            position=data["position"],
            token_types=data.get("token_types", []),
            alternative_tokens=alternative_tokens,
            attention_snapshot=attention_snapshot,
        )
        return token


@dataclass
class TokenNode:
    token: Token

    branch_id: str  # to identify which sample this token belongs to

    prev: "TokenNode | None" = None
    next: list["TokenNode"] = field(default_factory=list)

    def to_dict(self) -> dict:
        token_data = self.token.to_dict()
        token_data["branch_id"] = self.branch_id

        return token_data


@dataclass
class TokenLeafNodeWrapper:
    token: TokenNode
    depth: int
    branch_id: str


@dataclass
class GenerationTree:
    root: TokenNode | None = None
    leaves: list[TokenLeafNodeWrapper] = field(default_factory=list)
    branch_ids: set[str] = field(default_factory=set)

    def add_token(
        self,
        token_node: TokenNode,
    ) -> TokenNode:
        if len(self.leaves) == 0:
            # First token being added
            self.root = token_node
            leaf = TokenLeafNodeWrapper(
                token=token_node, depth=0, branch_id=token_node.branch_id
            )
            self.leaves.append(leaf)
            self.branch_ids.add(token_node.branch_id)
            return token_node
        else:
            current_leaf = next(
                (
                    leaf
                    for leaf in self.leaves
                    if leaf.branch_id == token_node.branch_id
                ),
                None,
            )
            assert (
                current_leaf is not None
            ), f"No leaf found for branch_id: {token_node.branch_id}"

            token_node.prev = current_leaf.token
            token_node.token.position = current_leaf.token.token.position + 1
            current_leaf.token.next.append(token_node)
            current_leaf.token = token_node
            current_leaf.depth += 1
            return token_node

    def create_new_branch(
        self,
        token_node: TokenNode,
        starting_branch_id: str,
        branch_position: int,
    ):
        current_branch = self.get_token_list(starting_branch_id)
        if branch_position >= len(current_branch):
            raise ValueError(
                f"Branch position {branch_position} out of bounds for branch {starting_branch_id}"
            )
        current = current_branch[branch_position]
        token_node.prev = current
        token_node.token.position = current.token.position + 1
        current.next.append(token_node)
        leaf = TokenLeafNodeWrapper(
            token=token_node,
            depth=token_node.token.position,
            branch_id=token_node.branch_id,
        )
        self.leaves.append(leaf)
        self.branch_ids.add(token_node.branch_id)
        pass

    def get_leaf_token(self, branch_id: str) -> TokenNode | None:
        leaf = next(
            (leaf for leaf in self.leaves if leaf.branch_id == branch_id), None
        )
        return leaf.token if leaf else None

    def get_token_list(self, branch_id: str) -> list[TokenNode]:
        leaf = next(
            (leaf for leaf in self.leaves if leaf.branch_id == branch_id), None
        )
        tokens = []
        if leaf:
            current = leaf.token
            while current:
                tokens.append(current)
                current = current.prev
            tokens.reverse()
        return tokens

    def to_tree(self):
        nodes = []
        edges = []

        def traverse(
            token_node: TokenNode,
            parent_id: str | None = None,
            parent_text: str = "",
            parent_token_count: int = 0,
            parent_total_confidence: float = 0.0,
            depth: int = 0,
            y: int = 0,
            x: int = 0,
        ):
            text = ""
            current = token_node
            node_id = f"{token_node.branch_id}_{token_node.token.position}"
            token_count = 0
            total_confidence = 0.0
            while current:
                text += current.token.token_string
                token_count += 1
                total_confidence += current.token.confidence
                if len(current.next) == 0:
                    current = None
                elif len(current.next) == 1:
                    current = current.next[0]
                else:
                    node = {
                        "id": node_id,
                        "text": text,
                        "parent_text": parent_text,
                        "token_count": token_count,
                        "parent_token_count": parent_token_count,
                        "total_confidence": total_confidence,
                        "parent_total_confidence": parent_total_confidence,
                        "branch_id": token_node.branch_id,
                        "leaf": False,
                        "y": y,
                        "x": x,
                    }
                    nodes.append(node)
                    if parent_id:
                        edges.append({"from": parent_id, "to": node_id})
                    for i, child in enumerate(current.next):
                        traverse(
                            child,
                            node_id,
                            parent_text + text,
                            parent_token_count + token_count,
                            parent_total_confidence + total_confidence,
                            y + 1,
                            x + i,
                        )
                    break
            else:
                node = {
                    "id": node_id,
                    "text": text,
                    "parent_text": parent_text,
                    "token_count": token_count,
                    "parent_token_count": parent_token_count,
                    "total_confidence": total_confidence,
                    "parent_total_confidence": parent_total_confidence,
                    "branch_id": token_node.branch_id,
                    "leaf": True,
                    "y": y,
                    "x": x,
                }
                nodes.append(node)
                if parent_id:
                    edges.append({"from": parent_id, "to": node_id})

        if self.root:
            traverse(self.root)
        return nodes, edges
