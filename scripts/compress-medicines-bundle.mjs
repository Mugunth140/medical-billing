#!/usr/bin/env node
/**
 * Compress the medicines database for embedding in the Tauri binary
 */

import { createReadStream, createWriteStream, existsSync, statSync } from 'fs';
import { createGzip } from 'zlib';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

const INPUT_PATH = resolve(__dirname, '../src-tauri/resources/medicines-bundle.db');
const OUTPUT_PATH = resolve(__dirname, '../src-tauri/resources/medicines-bundle.db.gz');

async function main() {
    console.log('===========================================');
    console.log('Compress Medicines Database');
    console.log('===========================================\n');

    if (!existsSync(INPUT_PATH)) {
        console.error(`Error: Database not found at ${INPUT_PATH}`);
        process.exit(1);
    }

    const inputSize = statSync(INPUT_PATH).size;
    console.log(`Input: ${INPUT_PATH}`);
    console.log(`Input size: ${(inputSize / 1024 / 1024).toFixed(2)} MB`);

    console.log('\nCompressing with gzip (level 9)...');

    const gzip = createGzip({ level: 9 });
    const source = createReadStream(INPUT_PATH);
    const destination = createWriteStream(OUTPUT_PATH);

    await pipeline(source, gzip, destination);

    const outputSize = statSync(OUTPUT_PATH).size;
    const ratio = ((1 - outputSize / inputSize) * 100).toFixed(1);

    console.log(`\nOutput: ${OUTPUT_PATH}`);
    console.log(`Output size: ${(outputSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Compression ratio: ${ratio}% reduction`);
    console.log('\n===========================================\n');
}

main().catch(console.error);
