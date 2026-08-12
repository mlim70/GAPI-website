/**
 * One-time script to download all images from AWS S3 buckets
 * into frontend/public/images/ organized by category.
 *
 * Also generates image manifest JSON files in frontend/src/data/
 * so the frontend knows which images exist (since it can't list directories at runtime).
 *
 * Usage:
 *   npx tsx scripts/downloadS3Images.ts
 *
 * Requires: backend/.env with AWS credentials and bucket names.
 */

import 'dotenv/config';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { Readable } from 'stream';

// ─── Configuration from environment ────────────────────────────────────────
const REGION = process.env.AWS_REGION || 'us-east-1';
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;

if (!ACCESS_KEY || !SECRET_KEY) {
  console.error('❌ AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set in backend/.env');
  process.exit(1);
}

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

// ─── Bucket / folder → local directory mapping ─────────────────────────────
interface DownloadTask {
  bucket: string;
  folder?: string;             // S3 prefix (folder). Omit to download everything.
  localDir: string;            // Destination inside frontend/public/images/
  manifestName: string;        // Name of the JSON manifest file to generate
  skipFiles?: string[];        // Files to skip (e.g. metadata files)
}

const FRONTEND_PUBLIC = join(__dirname, '..', 'frontend', 'public', 'images');
const FRONTEND_DATA = join(__dirname, '..', 'frontend', 'src', 'data');

const TASKS: DownloadTask[] = [
  {
    bucket: process.env.AWS_S3_HOME_BUCKET || 'gapi-home',
    folder: process.env.AWS_S3_HERO_FOLDER || 'hero',
    localDir: join(FRONTEND_PUBLIC, 'hero'),
    manifestName: 'heroImages.json',
  },
  {
    bucket: process.env.AWS_S3_HOME_BUCKET || 'gapi-home',
    folder: process.env.AWS_S3_GALLERY_FOLDER || 'gallery',
    localDir: join(FRONTEND_PUBLIC, 'gallery'),
    manifestName: 'galleryImages.json',
  },
  {
    bucket: process.env.AWS_S3_CLINIC_BUCKET || 'gapi-clinic',
    folder: process.env.AWS_S3_HERO_FOLDER || 'hero',
    localDir: join(FRONTEND_PUBLIC, 'clinic'),
    manifestName: 'clinicImages.json',
  },
  {
    bucket: process.env.AWS_S3_EXEC_BUCKET || 'gapi-exec',
    folder: process.env.AWS_S3_EXEC_FOLDER || 'students-residents',
    localDir: join(FRONTEND_PUBLIC, 'exec'),
    manifestName: 'execImages.json',
  },
  {
    bucket: process.env.AWS_S3_SPONSOR_BUCKET || 'gapi-sponsors',
    folder: undefined, // download everything from root
    localDir: join(FRONTEND_PUBLIC, 'sponsors'),
    manifestName: 'sponsors.json', // will contain both image paths and metadata
    skipFiles: ['sponsors.json'],  // skip the S3 metadata file itself
  },
];

// ─── Image extensions filter ────────────────────────────────────────────────
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function listAllObjects(bucket: string, prefix?: string) {
  const objects: { Key: string; Size: number; LastModified?: Date }[] = [];
  let continuationToken: string | undefined;

  do {
    const cmd = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix ? (prefix.endsWith('/') ? prefix : `${prefix}/`) : undefined,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    });

    const result = await s3.send(cmd);

    if (result.Contents) {
      for (const obj of result.Contents) {
        if (obj.Key && obj.Size && obj.Size > 0) {
          objects.push({
            Key: obj.Key,
            Size: obj.Size,
            LastModified: obj.LastModified,
          });
        }
      }
    }

    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

async function downloadObject(bucket: string, key: string, destPath: string) {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const result = await s3.send(cmd);

  if (!result.Body) {
    console.warn(`  ⚠️  No body for ${key}, skipping`);
    return;
  }

  const buffer = await streamToBuffer(result.Body as Readable);
  writeFileSync(destPath, buffer);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('🚀 S3 Image Download Script');
  console.log('============================\n');

  // Ensure data directory exists
  mkdirSync(FRONTEND_DATA, { recursive: true });

  // Also try to read the existing sponsors.json from S3 for metadata (names, websites)
  let sponsorMetadata: Record<string, any> = {};
  const sponsorBucket = process.env.AWS_S3_SPONSOR_BUCKET || 'gapi-sponsors';
  try {
    const cmd = new GetObjectCommand({ Bucket: sponsorBucket, Key: 'sponsors.json' });
    const result = await s3.send(cmd);
    if (result.Body) {
      const content = await streamToBuffer(result.Body as Readable);
      sponsorMetadata = JSON.parse(content.toString('utf-8'));
      console.log(`📋 Loaded sponsor metadata from S3 (${Object.keys(sponsorMetadata).length} entries)\n`);
    }
  } catch {
    console.log('ℹ️  No sponsors.json metadata found in S3, will generate names from filenames.\n');
  }

  for (const task of TASKS) {
    console.log(`\n📁 ${task.bucket}/${task.folder || '(root)'} → ${task.localDir}`);
    console.log('─'.repeat(60));

    // Create local directory
    mkdirSync(task.localDir, { recursive: true });

    // List objects
    const objects = await listAllObjects(task.bucket, task.folder);
    console.log(`   Found ${objects.length} objects`);

    // Filter to images only (skip directories, hidden files, metadata)
    const imageObjects = objects.filter(obj => {
      const filename = basename(obj.Key);
      if (filename.startsWith('.')) return false;
      if (task.skipFiles?.includes(filename)) return false;
      if (!IMAGE_EXTENSIONS.test(filename)) return false;
      return true;
    });

    console.log(`   ${imageObjects.length} image files to download\n`);

    const manifestEntries: string[] = [];
    const sponsorEntries: any[] = [];

    for (let i = 0; i < imageObjects.length; i++) {
      const obj = imageObjects[i];
      const filename = basename(obj.Key);
      const destPath = join(task.localDir, filename);

      if (existsSync(destPath)) {
        console.log(`   ⏭️  [${i + 1}/${imageObjects.length}] ${filename} (already exists, skipping)`);
      } else {
        console.log(`   ⬇️  [${i + 1}/${imageObjects.length}] ${filename} (${(obj.Size / 1024).toFixed(1)} KB)`);
        await downloadObject(task.bucket, obj.Key, destPath);
      }

      // Build manifest path relative to /images/
      const category = task.localDir.split('images')[1]?.replace(/\\/g, '/') || '';
      const relativePath = `/images${category}/${filename}`;

      if (task.manifestName === 'sponsors.json') {
        // For sponsors, build a richer entry with metadata
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
        const meta = sponsorMetadata[obj.Key] || sponsorMetadata[nameWithoutExt] || {};

        sponsorEntries.push({
          id: nameWithoutExt,
          name: meta.name || nameWithoutExt.replace(/[-_]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          logo: relativePath,
          website: meta.website || null,
        });
      } else {
        manifestEntries.push(relativePath);
      }
    }

    // Write manifest
    const manifestPath = join(FRONTEND_DATA, task.manifestName);
    if (task.manifestName === 'sponsors.json') {
      writeFileSync(manifestPath, JSON.stringify(sponsorEntries, null, 2), 'utf-8');
      console.log(`\n   📝 Wrote ${manifestPath} (${sponsorEntries.length} sponsors)`);
    } else {
      writeFileSync(manifestPath, JSON.stringify(manifestEntries, null, 2), 'utf-8');
      console.log(`\n   📝 Wrote ${manifestPath} (${manifestEntries.length} images)`);
    }
  }

  console.log('\n\n✅ All downloads complete!');
  console.log('\nGenerated manifests:');
  for (const task of TASKS) {
    console.log(`   📄 frontend/src/data/${task.manifestName}`);
  }
  console.log('\nGenerated image directories:');
  for (const task of TASKS) {
    const rel = task.localDir.split('frontend')[1]?.replace(/\\/g, '/') || task.localDir;
    console.log(`   📁 frontend${rel}`);
  }
  console.log('\n🎉 You can now proceed with removing the S3 code!');
}

run().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
