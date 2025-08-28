import { Command } from 'commander'
import { TaskRunnerError } from './types.ts'
import { 
    RunCommand, 
    ListCommand, 
    ValidateCommand, 
    GraphCommand, 
    ServeCommand,
    StackCommand,
    TestStackCommand 
} from './commands/index.ts'

export class CLI {
    private program: Command
    private runCommand: RunCommand
    private listCommand: ListCommand
    private validateCommand: ValidateCommand
    private graphCommand: GraphCommand
    private serveCommand: ServeCommand
    private stackCommand: StackCommand
    private testStackCommand: TestStackCommand

    constructor() {
        this.program = new Command()
        this.runCommand = new RunCommand()
        this.listCommand = new ListCommand()
        this.validateCommand = new ValidateCommand()
        this.graphCommand = new GraphCommand()
        this.serveCommand = new ServeCommand()
        this.stackCommand = new StackCommand()
        this.testStackCommand = new TestStackCommand()
        this.setupCommands()
    }

    private setupCommands(): void {
        this.program
            .name('alf')
            .description('A lightweight CLI tool for executing YAML-defined tasks')
            .version('1.0.0')
            .configureHelp({
                sortSubcommands: true,
            })
            .exitOverride() // Prevent automatic process.exit()
            .configureOutput({
                writeErr: (str: string) => {
                    // Suppress the "error: unknown command" message when no actual commands are given
                    // This happens when the binary name itself is interpreted as a command
                    if (str.includes('error: unknown command')) {
                        const args = process.argv.slice(2)
                        // If there are no args, or the only arg is the binary name/path, suppress the error
                        if (args.length === 0 || args.every(arg => arg.includes('alf'))) {
                            return
                        }
                    }
                    process.stderr.write(str)
                }
            })

        // Run command
        this.program
            .command('run')
            .description('Run all tasks or specific tasks')
            .argument('<config-file>', 'YAML configuration file')
            .option('--task <tasks>', 'Run specific tasks (comma-separated)')
            .option('--continue-on-error', 'Continue execution even if a task fails')
            .option('-v, --verbose', 'Enable verbose output')
            .action(async (configFile, options) => {
                await this.handleCommand(() => this.runCommand.execute(configFile, options))
            })

        // List command
        this.program
            .command('list')
            .description('List all available tasks')
            .argument('<config-file>', 'YAML configuration file')
            .action(async (configFile) => {
                await this.handleCommand(() => this.listCommand.execute(configFile))
            })

        // Validate command
        this.program
            .command('validate')
            .description('Validate configuration file')
            .argument('<config-file>', 'YAML configuration file')
            .action(async (configFile) => {
                await this.handleCommand(() => this.validateCommand.execute(configFile))
            })

        // Graph command
        this.program
            .command('graph')
            .description('Show task dependency graph')
            .argument('<config-file>', 'YAML configuration file')
            .action(async (configFile) => {
                await this.handleCommand(() => this.graphCommand.execute(configFile))
            })

        // Serve command
        this.program
            .command('serve')
            .description('Start HTTP API server')
            .option('-p, --port <port>', 'Port to listen on', '3000')
            .option('-h, --host <host>', 'Host to bind to', '0.0.0.0')
            .action(async (options) => {
                await this.handleCommand(() => this.serveCommand.execute(options))
            })

        // Stack command
        this.program
            .command('stack')
            .description('Create a new Docker stack with docker-compose.yml and .env')
            .argument('[stack-name]', 'Name of the stack to create')
            .option('-t, --template <template>', 'Template to use (node, python, go)', 'node')
            .option('-l, --list', 'List available templates')
            .action(async (stackName, options) => {
                await this.handleCommand(() => this.stackCommand.execute(stackName, options))
            })

        // Test Stack command
        this.program
            .command('test-stack')
            .description('Test a created stack by starting it and running health checks')
            .argument('<stack-name>', 'Name of the stack to test')
            .option('-c, --cleanup', 'Clean up stack after testing')
            .option('-t, --timeout <ms>', 'Timeout for health checks in milliseconds', '30000')
            .action(async (stackName, options) => {
                await this.handleCommand(() => this.testStackCommand.execute(stackName, {
                    cleanup: options.cleanup,
                    timeout: parseInt(options.timeout)
                }))
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
        // Check if no commands provided before parsing
        const args = process.argv.slice(2)
        if (args.length === 0) {
            this.program.outputHelp()
            return
        }
        
        try {
            await this.program.parseAsync(process.argv)
        } catch (error: any) {
            // Handle Commander.js errors gracefully
            if (error.code === 'commander.unknownCommand') {
                this.program.outputHelp()
                process.exit(1)
            }
            throw error
        }
    }
}
