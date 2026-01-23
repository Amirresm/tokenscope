import argparse


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-s", type=bool)
    parser.add_argument("-g", type=bool)
    parser.add_argument("-u", type=bool)
    args = parser.parse_args()

    if args.s:
        import uvicorn
        from src.server.server import create_app

        app = create_app()
        uvicorn.run(app, host="0.0.0.0", port=4000, workers=1, loop="asyncio")
    elif args.g:
        import uvicorn
        from src.generator.server.gen_server import create_app

        app = create_app()
        uvicorn.run(app, host="0.0.0.0", port=4001, workers=1, loop="asyncio")
    elif args.u:
        import uvicorn
        from scripts.ui_server import create_app

        app = create_app()
        uvicorn.run(app, host="0.0.0.0", port=3000, workers=1, loop="asyncio")
    else:
        print("Starting all servers...")
        import multiprocessing

        def run_server(target, port):
            import uvicorn

            LOGGING_CONFIG = uvicorn.config.LOGGING_CONFIG.copy() # type: ignore
            LOGGING_CONFIG["formatters"]["default"][
                "fmt"
            ] = "[%(processName)s] %(asctime)s %(levelprefix)s %(message)s"
            LOGGING_CONFIG["formatters"]["access"][
                "fmt"
            ] = "[%(processName)s] %(asctime)s %(levelprefix)s %(client_addr)s - '%(request_line)s' %(status_code)s"

            app = target()
            uvicorn.run(
                app,
                host="0.0.0.0",
                port=port,
                workers=1,
                loop="asyncio",
                log_config=LOGGING_CONFIG,
            )

        processes = []
        from src.server.server import create_app as create_app

        processes.append(
            multiprocessing.Process(
                target=run_server,
                args=(create_app, 4000),
                name="API",
            )
        )
        from src.generator.server.gen_server import create_app as create_gen_app

        processes.append(
            multiprocessing.Process(
                target=run_server,
                args=(create_gen_app, 4001),
                name="GEN",
            )
        )
        from scripts.ui_server import create_app as create_ui_app

        processes.append(
            multiprocessing.Process(
                target=run_server, args=(create_ui_app, 3000), name="WEB"
            )
        )
        for p in processes:
            p.start()
        for p in processes:
            p.join()


if __name__ == "__main__":
    main()
