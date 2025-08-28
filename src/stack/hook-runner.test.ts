import { test, expect } from 'bun:test'
import { HookRunner } from './hook-runner.ts'
import { StackCommand, StackContext } from './types.ts'
import { mkdtemp, rmdir } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

test('HookRunner runs simple commands successfully', async () => {
    const runner = new HookRunner()
    const testDir = await mkdtemp(path.join(tmpdir(), 'hook-test-'))
    
    try {
        const commands: StackCommand[] = [
            {
                name: 'create-file',
                command: 'touch test.txt',
                description: 'Create test file'
            }
        ]

        const context: StackContext = {
            stackName: 'test',
            stackDir: testDir,
            variables: {},
            template: {
                name: 'test',
                description: 'Test template',
                dockerCompose: '',
                env: ''
            }
        }

        await runner.runHooks(commands, context)
        
        // Verify file was created
        const file = Bun.file(path.join(testDir, 'test.txt'))
        expect(await file.exists()).toBe(true)
        
    } finally {
        await rmdir(testDir, { recursive: true })
    }
})

test('HookRunner interpolates variables in commands', async () => {
    const runner = new HookRunner()
    const testDir = await mkdtemp(path.join(tmpdir(), 'hook-test-'))
    
    try {
        const commands: StackCommand[] = [
            {
                name: 'create-named-file',
                command: 'echo "${message}" > ${filename}',
                description: 'Create file with message'
            }
        ]

        const context: StackContext = {
            stackName: 'test',
            stackDir: testDir,
            variables: {
                message: 'Hello World',
                filename: 'output.txt'
            },
            template: {
                name: 'test',
                description: 'Test template',
                dockerCompose: '',
                env: ''
            }
        }

        await runner.runHooks(commands, context)
        
        // Verify file was created with correct content
        const content = await Bun.file(path.join(testDir, 'output.txt')).text()
        expect(content.trim()).toBe('Hello World')
        
    } finally {
        await rmdir(testDir, { recursive: true })
    }
})

test('HookRunner respects working directory option', async () => {
    const runner = new HookRunner()
    const testDir = await mkdtemp(path.join(tmpdir(), 'hook-test-'))
    const subDir = path.join(testDir, 'subdir')
    await Bun.$`mkdir -p ${subDir}`
    
    try {
        const commands: StackCommand[] = [
            {
                name: 'create-file-in-subdir',
                command: 'touch test-subdir.txt',
                description: 'Create file in subdirectory',
                workingDir: './subdir'
            }
        ]

        const context: StackContext = {
            stackName: 'test',
            stackDir: testDir,
            variables: {},
            template: {
                name: 'test',
                description: 'Test template',
                dockerCompose: '',
                env: ''
            }
        }

        await runner.runHooks(commands, context)
        
        // Verify file was created in subdirectory
        const file = Bun.file(path.join(subDir, 'test-subdir.txt'))
        expect(await file.exists()).toBe(true)
        
        // Verify file was NOT created in main directory
        const mainFile = Bun.file(path.join(testDir, 'test-subdir.txt'))
        expect(await mainFile.exists()).toBe(false)
        
    } finally {
        await rmdir(testDir, { recursive: true })
    }
})

test('HookRunner throws error on command failure', async () => {
    const runner = new HookRunner()
    const testDir = await mkdtemp(path.join(tmpdir(), 'hook-test-'))
    
    try {
        const commands: StackCommand[] = [
            {
                name: 'failing-command',
                command: 'exit 1',
                description: 'Command that fails'
            }
        ]

        const context: StackContext = {
            stackName: 'test',
            stackDir: testDir,
            variables: {},
            template: {
                name: 'test',
                description: 'Test template',
                dockerCompose: '',
                env: ''
            }
        }

        expect(async () => {
            await runner.runHooks(commands, context)
        }).toThrow('Command "failing-command" failed with exit code 1')
        
    } finally {
        await rmdir(testDir, { recursive: true })
    }
})

test('HookRunner throws error on invalid command', async () => {
    const runner = new HookRunner()
    const testDir = await mkdtemp(path.join(tmpdir(), 'hook-test-'))
    
    try {
        const commands: StackCommand[] = [
            {
                name: 'invalid-command',
                command: 'nonexistent-command-xyz',
                description: 'Command that does not exist'
            }
        ]

        const context: StackContext = {
            stackName: 'test',
            stackDir: testDir,
            variables: {},
            template: {
                name: 'test',
                description: 'Test template',
                dockerCompose: '',
                env: ''
            }
        }

        expect(async () => {
            await runner.runHooks(commands, context)
        }).toThrow(/Command "invalid-command" failed with exit code/)
        
    } finally {
        await rmdir(testDir, { recursive: true })
    }
})

test('HookRunner runs multiple commands in sequence', async () => {
    const runner = new HookRunner()
    const testDir = await mkdtemp(path.join(tmpdir(), 'hook-test-'))
    
    try {
        const commands: StackCommand[] = [
            {
                name: 'create-first-file',
                command: 'echo "first" > first.txt',
                description: 'Create first file'
            },
            {
                name: 'create-second-file',
                command: 'echo "second" > second.txt',
                description: 'Create second file'
            },
            {
                name: 'combine-files',
                command: 'cat first.txt second.txt > combined.txt',
                description: 'Combine files'
            }
        ]

        const context: StackContext = {
            stackName: 'test',
            stackDir: testDir,
            variables: {},
            template: {
                name: 'test',
                description: 'Test template',
                dockerCompose: '',
                env: ''
            }
        }

        await runner.runHooks(commands, context)
        
        // Verify all files exist
        expect(await Bun.file(path.join(testDir, 'first.txt')).exists()).toBe(true)
        expect(await Bun.file(path.join(testDir, 'second.txt')).exists()).toBe(true)
        expect(await Bun.file(path.join(testDir, 'combined.txt')).exists()).toBe(true)
        
        // Verify combined content
        const combinedContent = await Bun.file(path.join(testDir, 'combined.txt')).text()
        expect(combinedContent.trim()).toBe('first\nsecond')
        
    } finally {
        await rmdir(testDir, { recursive: true })
    }
})