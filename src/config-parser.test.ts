import { test, expect } from "bun:test";
import { ConfigParser } from "./config-parser.ts";
import { TaskRunnerError } from "./types.ts";

test("ConfigParser can parse valid YAML", async () => {
  const parser = new ConfigParser();
  const sampleConfig = `name: "Test Config"
version: "1.0"

tasks:
  test:
    name: "Test task"
    runs: echo "Hello World"
    env:
      TEST_VAR: "test"`;

  // Write temporary file
  await Bun.write("test-config.yml", sampleConfig);
  
  const taskFile = await parser.parseTaskFile("test-config.yml");
  
  expect(taskFile.name).toBe("Test Config");
  expect(taskFile.version).toBe("1.0");
  expect(taskFile.tasks.test.name).toBe("Test task");
  expect(taskFile.tasks.test.runs).toBe('echo "Hello World"');
  
  // Clean up
  await Bun.write("test-config.yml", "");
});

test("ConfigParser detects circular dependencies", async () => {
  const parser = new ConfigParser();
  const configWithCircular = `tasks:
  task1:
    runs: echo "task1"
    depends_on: [task2]
  task2:
    runs: echo "task2"
    depends_on: [task1]`;

  await Bun.write("circular-config.yml", configWithCircular);
  
  expect(async () => {
    await parser.parseTaskFile("circular-config.yml");
  }).toThrow(TaskRunnerError);
  
  // Clean up
  await Bun.write("circular-config.yml", "");
});

test("ConfigParser resolves dependency order", async () => {
  const parser = new ConfigParser();
  const configWithDeps = `tasks:
  task1:
    runs: echo "task1"
    depends_on: [task2, task3]
  task2:
    runs: echo "task2"
    depends_on: [task3]
  task3:
    runs: echo "task3"`;

  await Bun.write("deps-config.yml", configWithDeps);
  
  const taskFile = await parser.parseTaskFile("deps-config.yml");
  const order = parser.resolveDependencyOrder(taskFile.tasks);
  
  expect(order).toEqual(["task3", "task2", "task1"]);
  
  // Clean up
  await Bun.write("deps-config.yml", "");
});