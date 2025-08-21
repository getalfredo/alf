import { parseArgs } from 'util'
import { TaskRunner } from './task-runner.ts'
import { ConfigParser } from './config-parser.ts'
import { TaskRunnerError } from './types.ts'

export class CLI {
  private taskRunner: TaskRunner
  private configParser: ConfigParser

  constructor() {
    this.taskRunner = new TaskRunner()
    this.configParser = new ConfigParser()
  }

  async run(): Promise<void> {
    try {
      const args = this.parseCommandLine()

      switch (args.command) {
        case 'run':
          await this.runCommand(args)
          break
        case 'list':
          await this.listCommand(args)
          break
        case 'validate':
          await this.validateCommand(args)
          break
        case 'graph':
          await this.graphCommand(args)
          break
        case 'help':
        default:
          this.showHelp()
          break
      }
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

  private parseCommandLine() {
    const args = process.argv.slice(2)

    if (args.length === 0) {
      return { command: 'help' }
    }

    const command = args[0]

    if (!['run', 'list', 'validate', 'graph', 'help'].includes(command)) {
      throw new TaskRunnerError(`Unknown command: ${command}`)
    }

    const configFile = args[1]
    if (command !== 'help' && !configFile) {
      throw new TaskRunnerError(`Missing configuration file argument`)
    }
    if (command === 'help') {
      return { command }
    }

    // Parse additional arguments
    const parsed: any = { command, configFile }

    for (let i = 2; i < args.length; i++) {
      const arg = args[i]
      if (arg === '--task' && i + 1 < args.length) {
        parsed.tasks = args[i + 1].split(',').map((t) => t.trim())
        i++
      } else if (arg === '--verbose' || arg === '-v') {
        parsed.verbose = true
      } else if (arg === '--continue-on-error') {
        parsed.continueOnError = true
      }
    }

    return parsed
  }

  private async runCommand(args: any): Promise<void> {
    console.log(`🚀 Running tasks from ${args.configFile}`)

    if (!args.configFile) {
      throw new TaskRunnerError('Configuration file is required')
    }

    const options = {
      taskFile: args.configFile,
      tasks: args.tasks,
      continueOnError: args.continueOnError,
      verbose: args.verbose,
    }

    await this.taskRunner.run(options)
  }

  private async listCommand(args: any): Promise<void> {
    const taskFile = await this.configParser.parseTaskFile(args.configFile)

    console.log(`📋 Tasks in ${args.configFile}:`)
    console.log('')

    for (const [taskName, config] of Object.entries(taskFile.tasks)) {
      console.log(`  ${taskName}`)
      if (config.name) {
        console.log(`    📝 ${config.name}`)
      }
      if (config.depends_on && config.depends_on.length > 0) {
        console.log(`    📦 Depends on: ${config.depends_on.join(', ')}`)
      }
      console.log('')
    }
  }

  private async validateCommand(args: any): Promise<void> {
    console.log(`🔍 Validating ${args.configFile}`)

    try {
      const taskFile = await this.configParser.parseTaskFile(args.configFile)
      console.log(`✅ Configuration is valid`)
      console.log(`   Found ${Object.keys(taskFile.tasks).length} task(s)`)
    } catch (error) {
      console.log(
        `❌ Configuration is invalid: ${error instanceof Error ? error.message : String(error)}`
      )
      process.exit(1)
    }
  }

  private async graphCommand(args: any): Promise<void> {
    const taskFile = await this.configParser.parseTaskFile(args.configFile)

    console.log(`🔗 Dependency graph for ${args.configFile}:`)
    console.log('')

    const tasks = Object.keys(taskFile.tasks)
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

  private showHelp(): void {
    console.log(`
📚 Task Runner - A lightweight CLI tool for executing YAML-defined tasks

Usage:
  task-runner <command> <config-file> [options]

Commands:
  run <file>              Run all tasks or specific tasks
  list <file>             List all available tasks
  validate <file>         Validate configuration file
  graph <file>            Show task dependency graph
  help                    Show this help message

Options for 'run' command:
  --task <tasks>          Run specific tasks (comma-separated)
  --continue-on-error     Continue execution even if a task fails
  --verbose, -v           Enable verbose output

Examples:
  task-runner run tasks.yml
  task-runner run tasks.yml --task build,test
  task-runner list tasks.yml
  task-runner validate tasks.yml
  task-runner graph tasks.yml
`)
  }
}
