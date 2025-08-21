# Task Runner CLI

A lightweight command-line interface tool that executes tasks defined in YAML configuration files, inspired by GitHub Actions but with a much simpler, focused approach for local development and CI/CD workflows.

## Features

✅ **YAML Configuration** - Simple, intuitive task definitions  
✅ **Dependency Management** - Automatic task ordering with cycle detection  
✅ **Environment Variables** - Support for global and task-specific environment variables  
✅ **Error Handling** - Fail-fast or continue-on-error modes  
✅ **Shell Command Execution** - Full shell command support with multiline scripts  
✅ **Colorized Output** - Rich terminal output with emojis and progress indicators  
✅ **Task Validation** - Configuration validation before execution  
✅ **Dependency Visualization** - Graph view of task dependencies

## Installation

```bash
# Build the CLI
bun run build

# The executable will be available at dist/task-runner
```

## Usage

```bash
# Run all tasks
bun dist/task-runner run tasks.yml

# Run specific tasks
bun dist/task-runner run tasks.yml --task build,test

# List available tasks
bun dist/task-runner list tasks.yml

# Validate configuration
bun dist/task-runner validate tasks.yml

# Show dependency graph
bun dist/task-runner graph tasks.yml

# Get help
bun dist/task-runner help
```

### Command Options

- `--task <tasks>`: Run specific tasks (comma-separated)
- `--continue-on-error`: Continue execution even if a task fails
- `--verbose, -v`: Enable verbose output

## Configuration Format

### Basic Task Configuration

```yaml
name: 'Project Build Pipeline'
version: '1.0'

# Global environment variables
env:
    PROJECT_NAME: 'my-project'
    BUILD_ENV: 'production'

tasks:
    setup:
        name: 'Setup environment'
        runs: |
            echo "Setting up ${{ env.PROJECT_NAME }}"
            mkdir -p build
            npm install

    build:
        name: 'Build application'
        runs: |
            echo "Building in ${{ env.BUILD_ENV }} mode"
            npm run build
        depends_on: [setup]
        env:
            NODE_ENV: production

    test:
        name: 'Run tests'
        runs: npm test
        depends_on: [build]

    deploy:
        name: 'Deploy application'
        runs: |
            echo "Deploying to production"
            ./scripts/deploy.sh
        depends_on: [test]
        working_directory: ./deployment
```

### Configuration Schema

```yaml
# Root level (all optional except tasks)
name: string                    # Display name for the task file
version: string                 # Version identifier
env: map[string]string         # Global environment variables

tasks:
  task_name:
    name: string                # Display name for the task (optional)
    runs: string                # Shell commands (required)
    depends_on: []string        # List of dependency tasks (optional)
    env: map[string]string      # Task-specific environment variables (optional)
    working_directory: string   # Execution directory (optional)
    continue_on_error: boolean  # Continue if this task fails (optional, default: false)
```

## Examples

### Simple Build Pipeline

See `example-tasks.yml` for a complete example with setup, build, test, package, and clean tasks.

### Error Handling

See `test-error-tasks.yml` for examples of error handling and dependency skipping.

## Implementation Details

### Architecture

- **ConfigParser** (`src/config-parser.ts`): YAML parsing and validation
- **TaskRunner** (`src/task-runner.ts`): Task execution engine
- **CLI** (`src/cli.ts`): Command-line interface
- **Types** (`src/types.ts`): TypeScript type definitions

### Task Execution

1. **Parse Configuration**: Validate YAML and check for circular dependencies
2. **Resolve Dependencies**: Calculate execution order using topological sort
3. **Execute Tasks**: Run tasks in dependency order with environment variables
4. **Handle Errors**: Stop on failure or continue based on configuration
5. **Report Results**: Provide detailed execution summary

### Environment Variable Interpolation

Supports `${{ env.VARIABLE_NAME }}` and `${{ secrets.SECRET_NAME }}` syntax for variable interpolation in task commands.

#### Environment Variable Loading

Environment variables are loaded in the following priority order:

1. **Process environment** (`process.env`) - includes Bun's automatic `.env` file loading
2. **Global YAML env** - Variables defined in the root-level `env` section
3. **Task-specific env** - Variables defined in each task's `env` section

**Important**: `.env` files are only loaded from the current working directory where you run the task runner, not from the directory containing the YAML file. If you need environment variables from a different location, either:

- Run the task runner from that directory, or
- Define the variables directly in the YAML file's `env` section

### Dependency Management

- Automatic topological sorting of tasks
- Circular dependency detection
- Dependency failure handling (skip dependent tasks)
- Support for complex dependency graphs

## Testing

```bash
# Run unit tests
bun test

# Test CLI functionality
bun dist/task-runner validate example-tasks.yml
bun dist/task-runner run example-tasks.yml --task build
```

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Build executable
bun run build

# Run tests
bun test
```

## Requirements Met

This implementation fulfills all requirements from the PRD:

✅ YAML configuration format with tasks, dependencies, and environment variables  
✅ CLI interface with run, list, validate, and graph commands  
✅ Task execution with shell command support  
✅ Dependency management with cycle detection  
✅ Environment variable interpolation  
✅ Error handling with fail-fast and continue-on-error modes  
✅ Colorized output and progress indicators  
✅ Single binary distribution  
✅ Cross-platform support (built with Bun)  
✅ Comprehensive test coverage

The task runner is ready for production use and provides a simple yet powerful solution for local development and CI/CD automation.
