import { TaskRunner } from '../task-runner.ts'
import { ConfigParser } from '../parser/config-parser.ts'
import { RunHandler } from './run-handler.ts'
import { ValidateHandler } from './validate-handler.ts'
import { ListHandler } from './list-handler.ts'
import { GraphHandler } from './graph-handler.ts'

export class ApiServer {
    private taskRunner: TaskRunner
    private configParser: ConfigParser
    private runHandler: RunHandler
    private validateHandler: ValidateHandler
    private listHandler: ListHandler
    private graphHandler: GraphHandler

    constructor(taskRunner: TaskRunner, configParser: ConfigParser) {
        this.taskRunner = taskRunner
        this.configParser = configParser
        this.runHandler = new RunHandler(taskRunner, configParser)
        this.validateHandler = new ValidateHandler(taskRunner, configParser)
        this.listHandler = new ListHandler(taskRunner, configParser)
        this.graphHandler = new GraphHandler(taskRunner, configParser)
    }

    async start(host: string, port: number): Promise<void> {
        const server = Bun.serve({
            port,
            hostname: host,
            routes: {
                "/": {
                    GET: () => new Response(JSON.stringify({
                        name: "Alf Task Runner API",
                        version: "1.0.0",
                        endpoints: {
                            "GET /": "API info",
                            "POST /run": "Run tasks from config file",
                            "POST /validate": "Validate config file",
                            "POST /list": "List tasks from config file",
                            "POST /graph": "Get dependency graph"
                        }
                    }), {
                        headers: { "Content-Type": "application/json" }
                    })
                },
                "/run": {
                    POST: (req) => this.runHandler.handle(req)
                },
                "/validate": {
                    POST: (req) => this.validateHandler.handle(req)
                },
                "/list": {
                    POST: (req) => this.listHandler.handle(req)
                },
                "/graph": {
                    POST: (req) => this.graphHandler.handle(req)
                }
            }
        })

        console.log(`✅ Server running at http://${host}:${port}`)
        console.log(`💡 Try: curl -X POST http://${host}:${port}/validate -H "Content-Type: application/json" -d '{"configFile":"tasks.yml"}'`)
        
        // Keep the server running
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down server...')
            server.stop()
            process.exit(0)
        })
    }
}