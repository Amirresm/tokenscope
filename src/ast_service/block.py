from dataclasses import dataclass, field

import tree_sitter_python as tspython
from tree_sitter import Language, Parser, Node

from rich import print


@dataclass
class SourceRange:
    start: int
    end: int


@dataclass
class Block:
    # start: int
    # end: int
    total_range: SourceRange
    depth: int
    type: str
    parent_id: int | None
    source: str = ""
    text: bytes = b""
    id: int = -1
    local_index: int = 0

    unique_ranges: list[SourceRange] = field(default_factory=list)
    unique_sources: list[str] = field(default_factory=list)
    children: list["Block"] = field(default_factory=list)

    _id_counter: int = 0

    def __post_init__(self):
        if self.id == -1:
            self.id = Block._id_counter
            print(f"Creating Block id={self.id}")
            Block._id_counter += 1
            print("Global Block ID counter:", Block._id_counter)
        else:
            print(f"Using provided Block id={self.id}")

    def update_source(self, source_code: bytes):
        self.source = source_code[
            self.total_range.start : self.total_range.end + 1
        ].decode("utf8")
        self.text = source_code[
            self.total_range.start : self.total_range.end + 1
        ]

    def update_unique_sources(self, source_code: bytes):
        self.unique_sources = []
        for ur in self.unique_ranges:
            us = source_code[ur.start : ur.end].decode("utf8")
            self.unique_sources.append(us)

    def __repr__(self):
        return f"Block(start={self.total_range.start}, end={self.total_range.end}, depth={self.depth}, type='{self.type}', id={self.id}, local_index={self.local_index}, parent_id={self.parent_id})"


@dataclass
class AtomicBlock:
    id: int
    range: SourceRange
    type: str
    source: str
    depth: int


# @dataclass
# class BlockNode:
# type: str
#     start: int
#     end: int
#     depth: int
#     children: list["BlockNode | Block"]
#     parent_id: int | None


class BlockDetector:
    def __init__(self, parser: Parser):
        self.parser = parser

    def detect_blocks(self, source_code: str, root_node: Node | None = None):
        source_bytes = source_code.encode("utf8")
        if root_node is None:
            tree = self.parser.parse(source_bytes)
            root_node = tree.root_node

        root_block = self._walk2(source_bytes, root_node)
        if root_block is None:
            raise ValueError("Failed to create root block")

        self._fix_missing_and_overlaps(root_block)

        self._fix_indentation(root_block, source_bytes)

        atomic_blocks = self._to_atomic_blocks(root_block)

        blocks_list = self._flatten_blocks(root_block)

        for block in blocks_list:
            block.update_source(source_bytes)
            block.update_unique_sources(source_bytes)

        for i, block in enumerate(blocks_list):
            block.local_index = i

        return blocks_list, atomic_blocks

    def is_node_block(self, node: Node) -> bool:
        if node.type == "block":
            return True
        return False

    def _walk2(
        self,
        source_bytes: bytes,
        node: Node,
        current_block: Block | None = None,
        root_block: Block | None = None,
        depth=0,
    ):
        if node.type == "module":
            root_block = Block(
                # start=node.start_byte,
                # end=node.end_byte,
                total_range=SourceRange(
                    start=node.start_byte, end=node.end_byte
                ),
                depth=depth,
                type=node.type,
                parent_id=None,
            )
            current_block = root_block
            depth += 1

        elif self.is_node_block(node):
            parent_node = node.parent
            assert parent_node is not None, "Block node must have a parent"
            block = Block(
                # start=parent_node.start_byte,
                # end=parent_node.end_byte,
                total_range=SourceRange(
                    start=parent_node.start_byte, end=parent_node.end_byte
                ),
                depth=depth,
                type=parent_node.type,
                parent_id=current_block.id if current_block else None,
            )
            if current_block is not None:
                current_block.children.append(block)
            current_block = block
            depth += 1

        for child in node.children:
            self._walk2(source_bytes, child, current_block, root_block, depth)

        return root_block

    def _fix_missing_and_overlaps(self, root_block: Block):
        # just a check
        for i in range(len(root_block.children) - 1):
            cb = root_block.children[i]
            nb = root_block.children[i + 1]
            # assert (
            #     cb.total_range.end < nb.total_range.start
            # ), f"Blocks unexpected overlap: {cb} and {nb}"

        first_child = (
            root_block.children[0] if len(root_block.children) > 0 else None
        )
        if (
            first_child is not None
            and first_child.total_range.start > root_block.total_range.start
        ):
            root_block.unique_ranges.append(
                SourceRange(
                    start=root_block.total_range.start,
                    end=first_child.total_range.start,
                )
            )

        for i in range(len(root_block.children) - 1):
            cb = root_block.children[i]
            nb = root_block.children[i + 1]

            if nb.total_range.start > cb.total_range.end:
                root_block.unique_ranges.append(
                    SourceRange(
                        start=cb.total_range.end, end=nb.total_range.start
                    )
                )

        last_child = (
            root_block.children[-1] if len(root_block.children) > 0 else None
        )
        if (
            last_child is not None
            and last_child.total_range.end < root_block.total_range.end
        ):
            root_block.unique_ranges.append(
                SourceRange(
                    start=last_child.total_range.end,
                    end=root_block.total_range.end,
                )
            )

        for child in root_block.children:
            self._fix_missing_and_overlaps(child)

    def _fix_indentation(self, root_block: Block, source_bytes: bytes):
        # first fix inter children indentation
        root_block.update_source(source_bytes)
        root_block.update_unique_sources(source_bytes)

        for ur, lines in zip(
            root_block.unique_ranges, root_block.unique_sources
        ):
            lines = lines.split("\n")
            if len(lines) > 1 and lines[-1].strip() == "":
                num_indents = len(lines[-1])
                for child in root_block.children:
                    if child.total_range.start == ur.end:
                        child.total_range.start -= num_indents
                    for child_ur in child.unique_ranges:
                        if child_ur.start == ur.end:
                            child_ur.start -= num_indents
                ur.end -= num_indents

        root_block.update_source(source_bytes)
        root_block.update_unique_sources(source_bytes)

        for i in range(len(root_block.children) - 1):
            cb = root_block.children[i]
            nb = root_block.children[i + 1]

            cb.update_source(source_bytes)
            lines = cb.source.split("\n")
            if len(lines) > 1 and lines[-1].strip() == "":
                num_indents = len(lines[-1])
                # fix unique ranges
                for ur in root_block.unique_ranges:
                    if ur.start == cb.total_range.end:
                        ur.start -= num_indents
                    if ur.end == nb.total_range.start:
                        ur.end -= num_indents
                cb.total_range.end -= num_indents
                nb.total_range.start -= num_indents

            cb.update_source(source_bytes)
            nb.update_source(source_bytes)

        root_block.update_source(source_bytes)
        root_block.update_unique_sources(source_bytes)

        for child in root_block.children:
            self._fix_indentation(child, source_bytes)

    def _to_atomic_blocks(
        self, root_block: Block, atomic_blocks: list[AtomicBlock] | None = None
    ):
        if atomic_blocks is None:
            atomic_blocks = []
        if len(root_block.children) == 0:
            atomic_blocks.append(
                AtomicBlock(
                    id=root_block.id,
                    range=root_block.total_range,
                    type=root_block.type,
                    source=root_block.source,
                    depth=root_block.depth,
                )
            )
        else:
            urs = (
                root_block.unique_ranges
                if len(root_block.unique_ranges) > 0
                else [root_block.total_range]
            )
            sources = (
                root_block.unique_sources
                if len(root_block.unique_sources) > 0
                else [root_block.source]
            )
            first_ur = urs[0] if len(urs) > 0 else None
            first_child = (
                root_block.children[0] if len(root_block.children) > 0 else None
            )
            if (
                first_ur is not None
                and first_child is not None
                and first_ur.start <= first_child.total_range.start
            ):
                atomic_blocks.append(
                    AtomicBlock(
                        id=root_block.id,
                        range=first_ur,
                        type=root_block.type,
                        source=sources[0],
                        depth=root_block.depth,
                    )
                )

            for i in range(len(root_block.children)):
                child = root_block.children[i]

                self._to_atomic_blocks(child, atomic_blocks)
                if i + 1 < len(root_block.children):
                    next_child = root_block.children[i + 1]
                    for j in range(len(urs)):
                        ur = urs[j]
                        source = sources[j]

                        if (
                            ur.start >= child.total_range.end
                            and ur.end <= next_child.total_range.start
                        ):
                            atomic_blocks.append(
                                AtomicBlock(
                                    id=root_block.id,
                                    range=ur,
                                    type=root_block.type,
                                    source=source,
                                    depth=root_block.depth,
                                )
                            )

            last_ur = urs[-1] if len(urs) > 0 else None
            last_child = (
                root_block.children[-1]
                if len(root_block.children) > 0
                else None
            )
            if (
                last_ur is not None
                and last_child is not None
                and last_ur.end >= last_child.total_range.end
            ):
                atomic_blocks.append(
                    AtomicBlock(
                        id=root_block.id,
                        range=last_ur,
                        type=root_block.type,
                        source=sources[-1],
                        depth=root_block.depth,
                    )
                )

        return atomic_blocks

    def _flatten_blocks(self, block_node: Block) -> list[Block]:
        blocks = []
        blocks.append(block_node)
        for child in block_node.children:
            blocks.extend(self._flatten_blocks(child))
        return blocks

    @staticmethod
    def block_pretty_print(blocks: list[Block]):
        text_colors = [
            "red",
            "green",
            "blue",
            "yellow",
            "magenta",
            "cyan",
            "white",
        ]

        for i, block in enumerate(blocks):
            color = text_colors[i % len(text_colors)]
            print(f"[{color}]{block.source}[/]", end="")
        print("")


def main():
    code = '''# Below is a Python script with a self-contained function that solves the problem and passes corresponding tests:
import csv
import collections
import operator

def task_func(csv_file_path):
    """
    Find the best-selling product from a given CSV file with sales data.

    This function parses a CSV file assumed to have a header followed by rows containing
    two columns: 'product' and 'quantity'. It computes the total sales per product and
    determines the product with the highest cumulative sales. The CSV file must include
    at least these two columns, where 'product' is the name of the product as a string
    and 'quantity' is the number of units sold as an integer.

    Args:
        csv_file_path (str): The file path to the CSV file containing sales data.

    Returns:
        str: The name of the top-selling product based on the total quantity sold.

    Requirements:
    - csv
    - collections
    - operator

    Example:
    >>> task_func("path/to/sales.csv")
    'Product ABC'
    """
    with open(csv_file_path, 'r') as file:
        reader = csv.DictReader(file)
        sales_data = collections.defaultdict(int)
        for row in reader:
            product = row['product']
            quantity = int(row['quantity'])
            sales_data[product] += quantity

        sales_data = dict(sales_data)

    best_selling_product = max(sales_data.items(), key=operator.itemgetter(1.0))[0]

    return best_selling_product'''

    # with open("./src/ts/block.py", "r") as f:
    #     code = f.read()

    LANGUAGE = Language(tspython.language())
    parser = Parser(LANGUAGE)

    block_detector = BlockDetector(parser)
    blocks, _ = block_detector.detect_blocks(code)

    BlockDetector.block_pretty_print(blocks)


if __name__ == "__main__":
    main()
