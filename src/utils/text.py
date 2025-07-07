def visualize_whitespace(code: str) -> str:
    """
    Visualizes whitespace in the given code by replacing spaces with dots and tabs with arrows.
    """
    return code.replace(" ", "␣").replace("\t", "⇥").replace("\n", "⏎")
