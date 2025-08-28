import { Command } from 'commander'
import { TaskRunner } from './task-runner.ts'
import { ConfigParser } from './parser/config-parser.ts'
import { TaskRunnerError } from './types.ts'

export class CLI {
    private taskRunner: TaskRunner
    private configParser: ConfigParser
    private program: Command

    constructor() {
        this.taskRunner = new TaskRunner()
        this.configParser = new ConfigParser()
        this.program = new Command()
        this.setupCommands()
    }

    private setupCommands(): void {
        this.program
            .name('alf')
            .description('A lightweight CLI tool for executing YAML-defined tasks')
            .version('1.0.0')

        // Run command
        this.program
            .command('run')
            .description('Run all tasks or specific tasks')
            .argument('<config-file>', 'YAML configuration file')
            .option('--task <tasks>', 'Run specific tasks (comma-separated)')
            .option('--continue-on-error', 'Continue execution even if a task fails')
            .option('-v, --verbose', 'Enable verbose output')
            .action(async (configFile, options) => {
                await this.handleCommand(() => this.runCommand(configFile, options))
            })

        // List command
        this.program
            .command('list')
            .description('List all available tasks')
            .argument('<config-file>', 'YAML configuration file')
            .action(async (configFile) => {
                await this.handleCommand(() => this.listCommand(configFile))
            })

        // Validate command
        this.program
            .command('validate')
            .description('Validate configuration file')
            .argument('<config-file>', 'YAML configuration file')
            .action(async (configFile) => {
                await this.handleCommand(() => this.validateCommand(configFile))
            })

        // Graph command
        this.program
            .command('graph')
            .description('Show task dependency graph')
            .argument('<config-file>', 'YAML configuration file')
            .action(async (configFile) => {
                await this.handleCommand(() => this.graphCommand(configFile))
            })

        // Serve command
        this.program
            .command('serve')
            .description('Start HTTP API server')
            .option('-p, --port <port>', 'Port to listen on', '3000')
            .option('-h, --host <host>', 'Host to bind to', '0.0.0.0')
            .action(async (options) => {
                await this.handleCommand(() => this.serveCommand(options))
            })
    }

    private async handleCommand(commandFn: () => Promise<void>): Promise<void> {
        try {
            await commandFn()
        } catch (error) {
            if (error instanceof TaskRunnerError) {
                console.error(`❌ ${error.message}`)
                if (error.taskName) {
                    console.error(`   Task: ${error.taskName}`)
                }
                process.exit(error.exitCode || 1)
            } else {
                console.error(
                    `❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`
                )
                process.exit(1)
            }
        }
    }

    async run(): Promise<void> {
        await this.program.parseAsync()
    }

    private async runCommand(configFile: string, options: any): Promise<void> {
        console.log(`🚀 Running tasks from ${configFile}`)

        const tasks = options.task ? options.task.split(',').map((t: string) => t.trim()) : undefined

        const runOptions = {
            taskFile: configFile,
            tasks,
            continueOnError: options.continueOnError,
            verbose: options.verbose,
        }

        await this.taskRunner.run(runOptions)
    }

    private async listCommand(configFile: string): Promise<void> {
        const taskFile = await this.configParser.parseTaskFile(configFile)

        console.log(`📋 Tasks in ${configFile}:`)
        console.log('')

        for (const [taskName, config] of Object.entries(taskFile.tasks)) {
            console.log(`  ${taskName}`)
            if (config.name) {
                console.log(`    📝 ${config.name}`)
            }
            if (config.depends_on && config.depends_on.length > 0) {
                console.log(
                    `    📦 Depends on: ${config.depends_on.join(', ')}`
                )
            }
            console.log('')
        }
    }

    private async validateCommand(configFile: string): Promise<void> {
        console.log(`🔍 Validating ${configFile}`)

        try {
            const taskFile = await this.configParser.parseTaskFile(configFile)
            console.log(`✅ Configuration is valid`)
            console.log(
                `   Found ${Object.keys(taskFile.tasks).length} task(s)`
            )
        } catch (error) {
            console.log(
                `❌ Configuration is invalid: ${error instanceof Error ? error.message : String(error)}`
            )
            process.exit(1)
        }
    }

    private async graphCommand(configFile: string): Promise<void> {
        const taskFile = await this.configParser.parseTaskFile(configFile)

        console.log(`🔗 Dependency graph for ${configFile}:`)
        console.log('')

        const executionOrder = this.configParser.resolveDependencyOrder(
            taskFile.tasks
        )
        if (!executionOrder) {
            console.log('No tasks to display')
            return
        }

        console.log('Execution order:')
        executionOrder.forEach((task, index) => {
            console.log(`  ${index + 1}. ${task}`)
            const deps = taskFile.tasks[task].depends_on
            if (deps && deps.length > 0) {
                console.log(`     └─ depends on: ${deps.join(', ')}`)
            }
        })
    }

    private async serveCommand(options: any): Promise<void> {
        const port = parseInt(options.port)
        const host = options.host

        console.log(`🌐 Starting HTTP API server on ${host}:${port}`)

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
                    POST: async (req) => {
                        try {
                            const body = await req.json()
                            const { configFile, tasks, continueOnError, verbose } = body

                            if (!configFile) {
                                return new Response(JSON.stringify({
                                    error: "configFile is required"
                                }), {
                                    status: 400,
                                    headers: { "Content-Type": "application/json" }
                                })
                            }

                            const runOptions = {
                                taskFile: configFile,
                                tasks,
                                continueOnError,
                                verbose,
                            }

                            await this.taskRunner.run(runOptions)
                            
                            return new Response(JSON.stringify({
                                success: true,
                                message: `Tasks completed successfully from ${configFile}`
                            }), {
                                headers: { "Content-Type": "application/json" }
                            })
                        } catch (error) {
                            return new Response(JSON.stringify({
                                error: error instanceof Error ? error.message : String(error)
                            }), {
                                status: 500,
                                headers: { "Content-Type": "application/json" }
                            })
                        }
                    }
                },
                "/validate": {
                    POST: async (req) => {
                        try {
                            const body = await req.json()
                            const { configFile } = body

                            if (!configFile) {
                                return new Response(JSON.stringify({
                                    error: "configFile is required"
                                }), {
                                    status: 400,
                                    headers: { "Content-Type": "application/json" }
                                })
                            }

                            const taskFile = await this.configParser.parseTaskFile(configFile)
                            
                            return new Response(JSON.stringify({
                                valid: true,
                                taskCount: Object.keys(taskFile.tasks).length,
                                tasks: Object.keys(taskFile.tasks)
                            }), {
                                headers: { "Content-Type": "application/json" }
                            })
                        } catch (error) {
                            return new Response(JSON.stringify({
                                valid: false,
                                error: error instanceof Error ? error.message : String(error)
                            }), {
                                status: 400,
                                headers: { "Content-Type": "application/json" }
                            })
                        }
                    }
                },
                "/list": {
                    POST: async (req) => {
                        try {
                            const body = await req.json()
                            const { configFile } = body

                            if (!configFile) {
                                return new Response(JSON.stringify({
                                    error: "configFile is required"
                                }), {
                                    status: 400,
                                    headers: { "Content-Type": "application/json" }
                                })
                            }

                            const taskFile = await this.configParser.parseTaskFile(configFile)
                            
                            const tasks = Object.entries(taskFile.tasks).map(([name, config]) => ({
                                name,
                                description: config.name,
                                dependencies: config.depends_on || []
                            }))

                            return new Response(JSON.stringify({
                                configFile,
                                tasks
                            }), {
                                headers: { "Content-Type": "application/json" }
                            })
                        } catch (error) {
                            return new Response(JSON.stringify({
                                error: error instanceof Error ? error.message : String(error)
                            }), {
                                status: 500,
                                headers: { "Content-Type": "application/json" }
                            })
                        }
                    }
                },
                "/graph": {
                    POST: async (req) => {
                        try {
                            const body = await req.json()
                            const { configFile } = body

                            if (!configFile) {
                                return new Response(JSON.stringify({
                                    error: "configFile is required"
                                }), {
                                    status: 400,
                                    headers: { "Content-Type": "application/json" }
                                })
                            }

                            const taskFile = await this.configParser.parseTaskFile(configFile)
                            const executionOrder = this.configParser.resolveDependencyOrder(taskFile.tasks)
                            
                            return new Response(JSON.stringify({
                                configFile,
                                executionOrder,
                                tasks: Object.entries(taskFile.tasks).map(([name, config]) => ({
                                    name,
                                    dependencies: config.depends_on || []
                                }))
                            }), {
                                headers: { "Content-Type": "application/json" }
                            })
                        } catch (error) {
                            return new Response(JSON.stringify({
                                error: error instanceof Error ? error.message : String(error)
                            }), {
                                status: 500,
                                headers: { "Content-Type": "application/json" }
                            })
                        }
                    }
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
