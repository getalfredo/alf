#!/usr/bin/env bun

import { parseArgs } from 'util'
import { TaskRunner } from './task-runner.ts'
import { CLI } from './cli.ts'

async function main() {
    const cli = new CLI()
    await cli.run()
}

if (import.meta.main) {
    main().catch((error) => {
        console.error('Error:', error.message)
        process.exit(1)
    })
}
