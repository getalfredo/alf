import { TaskFile, TaskConfig, TaskRunnerError } from "./types.ts";

export class ConfigParser {
  private interpolateVariables(value: string, env: Record<string, string>, secrets: Record<string, string> = {}): string {
    return value.replace(/\$\{\{\s*(env|secrets)\.([A-Z_]+)\s*\}\}/g, (match, type, key) => {
      if (type === 'env') {
        return env[key] || process.env[key] || '';
      } else if (type === 'secrets') {
        return secrets[key] || process.env[key] || '';
      }
      return match;
    });
  }

  async parseTaskFile(filePath: string): Promise<TaskFile> {
    try {
      const file = Bun.file(filePath);
      const content = await file.text();
      
      // Simple YAML parser - this is a basic implementation
      // In a production environment, you'd want to use a proper YAML library
      const taskFile = this.parseYAML(content);
      
      this.validateTaskFile(taskFile);
      return taskFile;
    } catch (error) {
      throw new TaskRunnerError(`Failed to parse task file: ${error.message}`);
    }
  }

  private parseYAML(content: string): TaskFile {
    const lines = content.split('\n');
    const result: any = {};
    let currentSection: string | null = null;
    let currentTask: string | null = null;
    let indent = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const currentIndent = line.length - line.trimLeft().length;
      
      if (trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();
        
        if (currentIndent === 0) {
          if (key === 'tasks') {
            result.tasks = {};
            currentSection = 'tasks';
          } else {
            // Remove quotes from string values
            const cleanValue = value.replace(/^"(.*)"$/, '$1');
            result[key] = cleanValue || undefined;
            currentSection = null;
          }
        } else if (currentSection === 'tasks' && currentIndent === 2) {
          currentTask = key;
          result.tasks[key] = {};
        } else if (currentTask && currentIndent === 4) {
          if (key === 'depends_on') {
            // Parse array format [task1, task2]
            if (value.startsWith('[') && value.endsWith(']')) {
              const items = value.slice(1, -1).split(',').map(s => s.trim());
              result.tasks[currentTask][key] = items;
            } else {
              result.tasks[currentTask][key] = [value];
            }
          } else if (key === 'env') {
            result.tasks[currentTask][key] = {};
          } else if (key === 'runs') {
            // Handle multiline commands
            if (value === '|') {
              // Multi-line literal style
              let commandLines = [];
              let j = i + 1;
              while (j < lines.length) {
                const nextLine = lines[j];
                const nextIndent = nextLine.length - nextLine.trimLeft().length;
                if (nextIndent > 4 && nextLine.trim()) {
                  commandLines.push(nextLine.substring(6)); // Remove 6 spaces (4 for task + 2 for runs indentation)
                  i = j;
                } else if (nextLine.trim() === '') {
                  commandLines.push('');
                  i = j;
                } else {
                  break;
                }
                j++;
              }
              result.tasks[currentTask][key] = commandLines.join('\n');
            } else {
              result.tasks[currentTask][key] = value;
            }
          } else {
            const cleanValue = value.replace(/^"(.*)"$/, '$1');
            result.tasks[currentTask][key] = cleanValue === 'true' ? true : cleanValue === 'false' ? false : cleanValue;
          }
        } else if (currentTask && key.startsWith(' ') && result.tasks[currentTask].env) {
          const envKey = key.trim();
          result.tasks[currentTask].env[envKey] = value;
        }
      }
    }
    
    return result as TaskFile;
  }

  private validateTaskFile(taskFile: TaskFile): void {
    if (!taskFile.tasks || Object.keys(taskFile.tasks).length === 0) {
      throw new TaskRunnerError("No tasks defined in configuration file");
    }

    for (const [taskName, config] of Object.entries(taskFile.tasks)) {
      this.validateTask(taskName, config);
    }

    // Check for circular dependencies
    this.checkCircularDependencies(taskFile.tasks);
  }

  private validateTask(taskName: string, config: TaskConfig): void {
    if (!config.runs || config.runs.trim() === '') {
      throw new TaskRunnerError(`Task '${taskName}' is missing required 'runs' field`);
    }

    if (config.depends_on) {
      if (!Array.isArray(config.depends_on)) {
        throw new TaskRunnerError(`Task '${taskName}' depends_on must be an array`);
      }
    }
  }

  private checkCircularDependencies(tasks: Record<string, TaskConfig>): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (taskName: string): void => {
      if (visiting.has(taskName)) {
        throw new TaskRunnerError(`Circular dependency detected involving task '${taskName}'`);
      }
      if (visited.has(taskName)) {
        return;
      }

      visiting.add(taskName);
      const task = tasks[taskName];
      
      if (task.depends_on) {
        for (const dep of task.depends_on) {
          if (!tasks[dep]) {
            throw new TaskRunnerError(`Task '${taskName}' depends on unknown task '${dep}'`);
          }
          visit(dep);
        }
      }

      visiting.delete(taskName);
      visited.add(taskName);
    };

    for (const taskName of Object.keys(tasks)) {
      if (!visited.has(taskName)) {
        visit(taskName);
      }
    }
  }

  resolveDependencyOrder(tasks: Record<string, TaskConfig>, requestedTasks?: string[]): string[] {
    const allTasks = requestedTasks || Object.keys(tasks);
    const resolved: string[] = [];
    const visited = new Set<string>();

    const visit = (taskName: string): void => {
      if (visited.has(taskName)) {
        return;
      }

      visited.add(taskName);
      const task = tasks[taskName];
      
      if (task.depends_on) {
        for (const dep of task.depends_on) {
          visit(dep);
        }
      }

      if (!resolved.includes(taskName)) {
        resolved.push(taskName);
      }
    };

    for (const taskName of allTasks) {
      if (!tasks[taskName]) {
        throw new TaskRunnerError(`Unknown task: ${taskName}`);
      }
      visit(taskName);
    }

    return resolved.filter(task => allTasks.includes(task) || 
      allTasks.some(requestedTask => this.isDependency(tasks, requestedTask, task)));
  }

  private isDependency(tasks: Record<string, TaskConfig>, taskName: string, potentialDep: string): boolean {
    const task = tasks[taskName];
    if (!task.depends_on) return false;
    
    if (task.depends_on.includes(potentialDep)) return true;
    
    return task.depends_on.some(dep => this.isDependency(tasks, dep, potentialDep));
  }
}