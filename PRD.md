# Product Requirements Document: Lightweight Task Runner CLI

## Overview

A simple, lightweight command-line interface tool that executes tasks defined in YAML configuration files, inspired by GitHub Actions but with a much simpler, focused approach for local development and CI/CD workflows.

## Problem Statement

Developers often need a simple way to define and execute repetitive tasks (builds, tests, deployments, etc.) in a consistent, reproducible manner without the complexity of full CI/CD platforms or build systems like Make, Gradle, or complex GitHub Actions workflows.

## Target Users

- **Primary**: Individual developers and small teams
- **Secondary**: DevOps engineers setting up simple automation
- **Tertiary**: Teams wanting lightweight CI/CD for simple projects

## Core Value Proposition

- **Simplicity**: Easy-to-understand YAML configuration
- **Portability**: Works across different environments and projects
- **Lightweight**: Minimal dependencies and fast execution
- **Familiar**: Similar syntax to GitHub Actions but simplified

## Functional Requirements

### 1. YAML Configuration Format

The tool should read task definitions from YAML files with the following structure:

```yaml
name: 'Project Build and Test'
version: '1.0'

tasks:
    build:
        name: 'Build application'
        runs: |
            docker compose build

    test:
        name: 'Run tests'
        runs: |
            docker compose up -d
            docker compose exec webapp test
        depends_on: [build]

    deploy:
        name: 'Deploy to staging'
        runs: |
            ./scripts/deploy.sh staging
        depends_on: [bui test]
        env:
            ENVIRONMENT: staging
            API_KEY: ${{ secrets.STAGING_API_KEY }}

    clean:
        name: 'Clean build artifacts'
        runs: |
            rm -rf bin/
            rm -rf dist/
```

### 2. CLI Interface

```bash
# Run all tasks in default order
task-runner run tasks.yml

# Run specific task
task-runner run tasks.yml --task build

# Run multiple specific tasks
task-runner run tasks.yml --task build,test

# List available tasks
task-runner list tasks.yml

# Validate configuration
task-runner validate tasks.yml

# Show task dependency graph
task-runner graph tasks.yml
```

### 3. Core Features

#### Task Execution

- Execute shell commands defined in `runs` field
- Support multi-line commands
- Capture and display stdout/stderr
- Return appropriate exit codes

#### Dependency Management

- Execute tasks in dependency order using `depends_on`
- Detect circular dependencies and fail gracefully
- Skip dependent tasks if prerequisite fails

#### Environment Variables

- Support environment variable injection via `env` field
- Support basic variable interpolation `${{ env.VAR_NAME }}`
- Support secrets interpolation `${{ secrets.SECRET_NAME }}`

#### Error Handling

- Stop execution on first failure (fail-fast)
- Optional continue-on-error mode
- Clear error reporting with task context

### 4. Configuration Schema

```yaml
# Root level
name: string (optional)
version: string (optional)
env: map[string]string (optional, global environment variables)

tasks:
  task_name:
    name: string (optional, display name)
    runs: string (required, shell commands)
    depends_on: []string (optional, dependency list)
    env: map[string]string (optional, task-specific environment)
    working_directory: string (optional, execution directory)
    continue_on_error: boolean (optional, default: false)
```

## Non-Functional Requirements

### Performance

- Start and execute simple tasks within 100ms
- Handle task files up to 1MB in size
- Support up to 100 tasks per file

### Usability

- Clear, actionable error messages
- Colorized output for better readability
- Progress indicators for long-running tasks

### Reliability

- Graceful handling of interrupted execution (Ctrl+C)
- Proper cleanup of temporary resources
- Deterministic execution order

### Portability

- Single binary distribution
- Cross-platform support (Linux, macOS, Windows)
- No external dependencies required

## Technical Constraints

### Implementation Language

- Bun (based on existing codebase)
- Use standard library where possible
- Minimal external dependencies

### File System

- Read-only access to task files
- Write access to working directory for task execution
- Respect file permissions and ownership

### Security

- No arbitrary code execution beyond defined shell commands
- Environment variable isolation between tasks
- No network access unless explicitly required by tasks

## User Stories

### Story 1: Developer Running Build Pipeline

**As a** developer  
**I want to** run a complete build pipeline with one command  
**So that** I can ensure my code is ready for deployment

**Acceptance Criteria:**

- Can define build, test, and package tasks in YAML
- Single command executes all tasks in correct order
- Clear feedback on success/failure

### Story 2: CI/CD Engineer Setting Up Automation

**As a** CI/CD engineer  
**I want to** define reusable task configurations  
**So that** I can standardize builds across multiple projects

**Acceptance Criteria:**

- YAML files are portable between environments
- Environment-specific variables can be configured
- Task dependencies are automatically resolved

### Story 3: Team Lead Validating Workflows

**As a** team lead  
**I want to** visualize task dependencies  
**So that** I can understand and optimize our build process

**Acceptance Criteria:**

- Can list all tasks and their dependencies
- Can validate configuration without execution
- Clear error messages for configuration issues

## Success Metrics

- **Adoption**: 100+ GitHub stars within 6 months
- **Usage**: Developers use it for 80% of their repetitive tasks
- **Performance**: Tasks execute 50% faster than equivalent shell scripts
- **Reliability**: 99.9% successful task execution rate

## Future Enhancements (Out of Scope for v1)

- Parallel task execution
- Remote task definitions (HTTP URLs)
- Plugin system for custom task types
- Web dashboard for task monitoring
- Integration with popular CI/CD platforms
- Caching mechanisms for task outputs
- Matrix builds (multiple parameter combinations)

## Dependencies and Assumptions

### Dependencies

- Bun
- YAML parsing library
- Terminal color library for enhanced output

### Assumptions

- Users are familiar with YAML syntax
- Users have basic command-line proficiency
- Tasks primarily consist of shell commands
- Local execution environment is trusted

## Risks and Mitigation

| Risk                                     | Impact | Probability | Mitigation                                         |
| ---------------------------------------- | ------ | ----------- | -------------------------------------------------- |
| Complex dependency cycles                | High   | Low         | Implement cycle detection and clear error messages |
| Performance issues with large task files | Medium | Medium      | Implement streaming YAML parsing and lazy loading  |
| Security concerns with shell execution   | High   | Low         | Document security best practices and add warnings  |
| Cross-platform compatibility issues      | Medium | Medium      | Extensive testing on all target platforms          |

## Definition of Done

- [ ] CLI can parse and validate YAML task files
- [ ] Tasks execute with proper dependency ordering
- [ ] Environment variable interpolation works
- [ ] Error handling provides clear, actionable messages
- [ ] Cross-platform binary distribution available
- [ ] Basic documentation and examples provided
- [ ] Unit tests cover core functionality
- [ ] Integration tests validate end-to-end workflows
