import argparse


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-s", type=bool)
    parser.add_argument("-g", type=bool)
    args = parser.parse_args()

    if args.s:
        import uvicorn
        from src.server.server import create_app

        app = create_app()
        # uvicorn.run(app, host="0.0.0.0", port=3000)
        uvicorn.run(app, host="0.0.0.0", port=4000, workers=1, loop="asyncio")
    elif args.g:
        import uvicorn
        from src.generator.server.gen_server import create_app

        app = create_app()
        uvicorn.run(app, host="0.0.0.0", port=4001, workers=1, loop="asyncio")
    else:
        print("Please specify either 'server' or 'gen' as an argument.")


if __name__ == "__main__":
    main()
