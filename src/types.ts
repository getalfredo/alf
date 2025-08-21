export interface TaskConfig {
  name?: string
  runs: string
  depends_on?: string[]
  env?: Record<string, string>
  working_directory?: string
  continue_on_error?: boolean
}

export interface TaskFile {
  name?: string
  version?: string
  env?: Record<string, string>
  tasks: Record<string, TaskConfig>
}

export interface TaskExecution {
  taskName: string
  config: TaskConfig
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  startTime?: Date
  endTime?: Date
  output?: string
  error?: string
  exitCode?: number
}

export interface ExecutionOptions {
  taskFile: string
  tasks?: string[]
  continueOnError?: boolean
  verbose?: boolean
}

export class TaskRunnerError extends Error {
  constructor(
    message: string,
    public taskName?: string,
    public exitCode?: number
  ) {
    super(message)
    this.name = 'TaskRunnerError'
  }
}
