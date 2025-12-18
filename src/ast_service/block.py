from dataclasses import dataclass

import tree_sitter_python as tspython
from tree_sitter import Language, Parser, Node

from rich import print


@dataclass
class Block:
    start: int
    end: int
    depth: int
    type: str
    parent_id: int | None
    source: str = ""
    text: bytes = b""
    id: int = -1
    local_index: int = 0

    _id_counter: int = 0

    def __post_init__(self):
        if self.id == -1:
            self.id = Block._id_counter
            print(f"Creating Block id={self.id}")
            Block._id_counter += 1
            print("Global Block ID counter:", Block._id_counter)
        else:
            print(f"Using provided Block id={self.id}")
        self.update_source(self.text)

    def update_source(self, source_code: bytes):
        self.source = source_code[self.start : self.end + 1].decode("utf8")
        self.text = source_code[self.start : self.end + 1]

    def __repr__(self):
        return f"Block(start={self.start}, end={self.end}, depth={self.depth}, type='{self.type}', id={self.id}, local_index={self.local_index}, parent_id={self.parent_id})"


@dataclass
class BlockNode:
    type: str
    start: int
    end: int
    depth: int
    children: list["BlockNode | Block"]
    parent_id: int | None


class BlockDetector:
    def __init__(self, parser: Parser):
        self.parser = parser

    def detect_blocks(
        self, source_code: str, root_node: Node | None = None
    ) -> list[Block]:
        source_bytes = source_code.encode("utf8")
        if root_node is None:
            tree = self.parser.parse(source_bytes)
            root_node = tree.root_node
        root_block = BlockNode(
            type="module",
            children=[],
            start=root_node.start_byte,
            end=root_node.end_byte,
            depth=0,
            parent_id=None,
        )

        self._walk(root_node, root_block, source_bytes)

        self._fill_block_tree(root_block, source_bytes)

        blocks_list = self._flatten_blocks(root_block)

        blocks_list = self._fix_indentation(blocks_list, source_bytes)

        for i, block in enumerate(blocks_list):
            block.local_index = i

        return blocks_list

    def _walk(
        self,
        node: Node,
        root_block: BlockNode,
        source_bytes: bytes,
        depth=0,
        max_depth=-1,
        parent_block_id: int | None = None,
    ):
        if depth > 32:
            return []

        max_depth = max(max_depth, depth)

        block_node = root_block
        current_block_id = parent_block_id
        if node.type == "block":
            parent = node.parent
            assert parent is not None, "Block node must have a parent"
            start = parent.start_byte
            end = parent.end_byte

            block = Block(
                start=start,
                end=end,
                depth=depth,
                type=parent.type,
                parent_id=parent_block_id,
            )
            block.update_source(source_bytes)
            current_block_id = block.id

            block_node = BlockNode(
                type=parent.type,
                children=[],
                start=start,
                end=end,
                depth=depth,
                parent_id=parent_block_id,
            )
            block_node.children.append(block)
            root_block.children.append(block_node)

        for child in node.children:
            self._walk(
                child,
                block_node,
                source_bytes,
                depth + 1,
                max_depth,
                parent_block_id=current_block_id,
            )

        if node.type == "block":
            if len(block_node.children) == 1:
                root_block.children.pop()
                root_block.children.append(block_node.children[0])

    def _fill_block_tree(self, root_block: BlockNode, source_code: bytes):
        print("Filling block tree...")
        first_block = next(
            iter(
                [
                    b.children[0]
                    for b in root_block.children
                    if isinstance(b, BlockNode)
                    and isinstance(b.children[0], Block)
                ]
            ),
            None,
        )

        if first_block is not None and first_block.start != 0:
            first_block = Block(
                start=0,
                end=first_block.start,
                depth=0,
                type="module",
                parent_id=None,
            )
            first_block.source = str(
                source_code[first_block.start : first_block.end]
            )
            # before adding, set all children parent ids to first_block id
            remaining_children: list[Block | BlockNode] = [root_block]
            while True:
                if len(remaining_children) == 0:
                    break
                current = remaining_children.pop()
                if current.parent_id is None:
                    current.parent_id = first_block.id
                if isinstance(current, BlockNode):
                    for child in current.children:
                        remaining_children.append(child)

            root_block.children.insert(0, first_block)
        self._fill_block_tree_recurse(root_block, source_code)

    def _fill_block_tree_recurse(self, node: BlockNode, source_code: bytes):
        for child in [c for c in node.children if isinstance(c, BlockNode)]:
            self._fill_block_tree_recurse(child, source_code)

        if len(node.children) < 2:
            return

        new_children = []
        s = node.start
        e = node.end
        for i in range(len(node.children) - 1):
            cb = node.children[i]
            nb = node.children[i + 1]

            if nb.start - cb.end < 1:
                # assert isinstance(cb, Block), "Child must be a Block"
                new_block = Block(
                    start=cb.start,
                    end=nb.start - 1,
                    depth=cb.depth,
                    type=cb.type,
                    id=cb.id if isinstance(cb, Block) else -1,
                    parent_id=cb.parent_id,
                )
                new_block.update_source(source_code)
                new_children.append(new_block)
            elif nb.start - cb.end > 1:
                new_children.append(cb)
                new_block = Block(
                    start=cb.end + 1,
                    end=nb.start - 1,
                    depth=node.depth,
                    type=node.type,
                    id=cb.id if isinstance(cb, Block) else -1,
                    parent_id=node.parent_id,
                )
                new_block.update_source(source_code)
                new_children.append(new_block)
            else:
                new_children.append(cb)

        last_block = node.children[-1]
        new_children.append(last_block)

        if e - last_block.end > 0:
            print("Adding trailing block ...")
            print(last_block)
            new_block = Block(
                start=last_block.end + 1,
                end=e,
                depth=node.depth,
                type=node.type,
                id=last_block.id if isinstance(last_block, Block) else -1,
                parent_id=last_block.parent_id,
            )
            new_block.update_source(source_code)
            new_children.append(new_block)

        node.children = new_children

    def _flatten_blocks(self, block_node: BlockNode) -> list[Block]:
        blocks = []
        for child in block_node.children:
            if isinstance(child, Block):
                blocks.append(child)
            elif isinstance(child, BlockNode):
                blocks.extend(self._flatten_blocks(child))
        return blocks

    def _fix_indentation(
        self, blocks_list: list[Block], source_bytes: bytes
    ) -> list[Block]:
        for i, block in enumerate(blocks_list):
            remaining_indens = block.source.split("\n")
            if (
                i < len(blocks_list) - 1
                and len(remaining_indens) > 1
                and remaining_indens[-1].strip() == ""
            ):
                num_indents = len(remaining_indens[-1])
                block.end -= num_indents
                blocks_list[i + 1].start -= num_indents
        for block in blocks_list:
            block.update_source(source_bytes)

        return blocks_list

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
    blocks = block_detector.detect_blocks(code)

    BlockDetector.block_pretty_print(blocks)


if __name__ == "__main__":
    main()
