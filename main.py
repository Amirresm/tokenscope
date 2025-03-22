import argparse

from src.model.wrapper import ControlTokenTypes, LlamaModelWrapper
from src.generator.gen import Generator


def custom():
    model_name = "/home/amirreza/projects/ai/models/llm/llama-3.2-3B-Instruct"
    wrapper = LlamaModelWrapper(model_name)
    generator = Generator(wrapper, stop_tokens=[ControlTokenTypes.EOS])

    generator.generate("How to make a cake", max_tokens=10, stream=True, log_metric=True)

    print("\n\n\n")

    for token in generator.generate_yield("How to make a cake", max_tokens=10, log_metric=True):
        print(token["token"], end="", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("server", nargs="?", type=bool)
    args = parser.parse_args()

    if args.server:
        import uvicorn
        from src.server.server import create_app

        app = create_app()
        uvicorn.run(app, host="0.0.0.0", port=3000)
    else:
        custom()


if __name__ == "__main__":
    main()
