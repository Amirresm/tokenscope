import argparse

from src.model.wrapper import ControlTokenTypes, LlamaModelWrapper
from src.generator.gen import Generator


def custom():
    model_name = "/mnt/storage/ai/models/llm/Qwen/Qwen2.5-Coder-1.5B"
    wrapper = LlamaModelWrapper(model_name)
    generator = Generator(wrapper, stop_tokens=[ControlTokenTypes.EOS])

    generator.generate_yield("How to make a cake", max_tokens=10, stream=True, log_metric=True)

    print("\n\n\n")

    for token in generator.generate_yield("How to make a cake", max_tokens=10, log_metric=True):
        print(token.token, end="", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("server", nargs="?", type=bool)
    args = parser.parse_args()

    if args.server:
        import uvicorn
        from src.server.server import create_app

        app = create_app()
        # uvicorn.run(app, host="0.0.0.0", port=3000)
        uvicorn.run(app, host="0.0.0.0", port=3000, workers=1, loop="asyncio")
    else:
        # custom()
        test = "How to make a cake"

        print(f"Test input: {test}")


if __name__ == "__main__":
    main()
