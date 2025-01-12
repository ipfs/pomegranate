/* eslint-env mocha */

import * as dagPb from '@ipld/dag-pb'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { unixfs, type UnixFS } from '../src/index.js'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'
import { largeFile, smallFile } from './fixtures/files.js'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

describe('stat', function () {
  this.timeout(120 * 1000)

  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })

    emptyDirCid = await fs.addDirectory()
  })

  it('stats an empty directory', async () => {
    await expect(fs.stat(emptyDirCid)).to.eventually.include({
      fileSize: 0n,
      dagSize: 2n,
      blocks: 1,
      type: 'directory'
    })
  })

  it('computes how much of the DAG is local', async () => {
    const largeFileCid = await fs.addBytes(largeFile)
    const block = await blockstore.get(largeFileCid)
    const node = dagPb.decode(block)

    expect(node.Links).to.have.lengthOf(5)

    await expect(fs.stat(largeFileCid)).to.eventually.include({
      fileSize: 5242880n,
      blocks: 6,
      localDagSize: 5243139n
    })

    // remove one of the blocks so we now have an incomplete DAG
    await blockstore.delete(node.Links[0].Hash)

    // block count and local file/dag sizes should be smaller
    await expect(fs.stat(largeFileCid)).to.eventually.include({
      fileSize: 5242880n,
      blocks: 5,
      localFileSize: 4194304n,
      localDagSize: 4194563n
    })
  })

  it('stats a raw node', async () => {
    const fileCid = await fs.addBytes(smallFile)

    await expect(fs.stat(fileCid)).to.eventually.include({
      fileSize: BigInt(smallFile.length),
      dagSize: 13n,
      blocks: 1,
      type: 'raw'
    })
  })

  it('stats a small file', async () => {
    const fileCid = await fs.addBytes(smallFile, {
      cidVersion: 0,
      rawLeaves: false
    })

    await expect(fs.stat(fileCid)).to.eventually.include({
      fileSize: BigInt(smallFile.length),
      dagSize: 19n,
      blocks: 1,
      type: 'file'
    })
  })

  it('stats a large file', async () => {
    const cid = await fs.addBytes(largeFile)

    await expect(fs.stat(cid)).to.eventually.include({
      fileSize: BigInt(largeFile.length),
      dagSize: 5242907n,
      blocks: 6,
      type: 'file'
    })
  })

  it('stats a directory with content', async () => {
    const emptyDirCid = await fs.addDirectory()
    const fileCid = await fs.addBytes(Buffer.from("Hello World!"))
    const updateDirCid = await fs.cp(fileCid, emptyDirCid, 'foo1.txt')
    const finalDirCid = await fs.cp(fileCid, updateDirCid, 'foo2.txt')

    await expect(fs.stat(finalDirCid)).to.eventually.include({
      fileSize: 0n,
      dagSize: 134n,
      blocks: 2,
      type: 'directory'
    })
  })

  it('should stat file with mode', async () => {
    const mode = 0o644
    const cid = await fs.addFile({
      content: smallFile,
      mode
    })

    await expect(fs.stat(cid)).to.eventually.include({
      mode
    })
  })

  it('should stat file with mtime', async function () {
    const mtime = {
      secs: 5n,
      nsecs: 0
    }
    const cid = await fs.addFile({
      content: smallFile,
      mtime
    })

    await expect(fs.stat(cid)).to.eventually.deep.include({
      mtime
    })
  })

  it('should stat a directory', async function () {
    await expect(fs.stat(emptyDirCid)).to.eventually.include({
      type: 'directory',
      blocks: 1,
      fileSize: 0n
    })
  })

  it('should stat dir with mode', async function () {
    const mode = 0o755
    const path = 'test-dir'
    const dirCid = await fs.mkdir(emptyDirCid, path, {
      mode
    })

    await expect(fs.stat(dirCid, {
      path
    })).to.eventually.include({
      mode
    })
  })

  it('should stat dir with mtime', async function () {
    const mtime = {
      secs: 5n,
      nsecs: 0
    }

    const path = 'test-dir'
    const dirCid = await fs.mkdir(emptyDirCid, path, {
      mtime
    })

    await expect(fs.stat(dirCid, {
      path
    })).to.eventually.deep.include({
      mtime
    })
  })

  it('sstats a sharded directory', async function () {
    const mtime = {
      secs: 5n,
      nsecs: 0
    }
    const shardedDirCid = await createShardedDirectory(blockstore)
    const updatedShardCid = await fs.touch(shardedDirCid, {
      mtime
    })

    const stat = await fs.stat(updatedShardCid)
    expect(stat).to.have.property('type', 'directory')
    expect(stat).to.have.nested.property('unixfs.type', 'hamt-sharded-directory')
    expect(stat).to.include({
      mode: 0o755
    })
    expect(stat).to.deep.include({
      mtime
    })
  })

  it('stats a file inside a sharded directory', async () => {
    const shardedDirCid = await createShardedDirectory(blockstore)
    const fileCid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3]), {
      rawLeaves: false
    })
    const fileName = `small-file-${Math.random()}.txt`
    const updatedShardCid = await fs.cp(fileCid, shardedDirCid, fileName)

    const stats = await fs.stat(updatedShardCid, {
      path: fileName
    })

    expect(stats.type).to.equal('file')
    expect(stats.fileSize).to.equal(4n)
  })

  it('refuses to stat missing blocks', async () => {
    const cid = await fs.addBytes(smallFile)

    await blockstore.delete(cid)
    expect(blockstore.has(cid)).to.be.false()

    await expect(fs.stat(cid, {
      offline: true
    })).to.eventually.be.rejected
      .with.property('name', 'NotFoundError')
  })
})
