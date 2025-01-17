/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import first from 'it-first'
import toBuffer from 'it-to-buffer'
import { CID } from 'multiformats/cid'
import { identity } from 'multiformats/hashes/identity'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { type MFS, mfs } from '../src/index.js'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'
import { createSubshardedDirectory } from './fixtures/create-subsharded-directory.js'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'

describe('cp', () => {
  let blockstore: Blockstore
  let datastore: Datastore
  let fs: MFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()
    datastore = new MemoryDatastore()

    fs = mfs({ blockstore, datastore })
  })

  it('refuses to copy files without a source', async () => {
    // @ts-expect-error invalid args
    await expect(fs.cp()).to.eventually.be.rejected.with('Please supply at least one source')
  })

  it('refuses to copy files without a source, even with options', async () => {
    // @ts-expect-error invalid args
    await expect(fs.cp({})).to.eventually.be.rejected.with('Please supply at least one source')
  })

  it('refuses to copy files without a destination', async () => {
    // @ts-expect-error invalid args
    await expect(fs.cp('/source')).to.eventually.be.rejected.with('Please supply at least one source')
  })

  it('refuses to copy files without a destination, even with options', async () => {
    // @ts-expect-error invalid args
    await expect(fs.cp('/source', {})).to.eventually.be.rejected.with('Please supply at least one source')
  })

  it('refuses to copy an unreadable node', async () => {
    const hash = identity.digest(uint8ArrayFromString('derp'))
    const source = CID.createV1(identity.code, hash)

    await expect(fs.cp(source, '/foo.txt')).to.eventually.be.rejected
      .with.property('name', 'NotUnixFSError')
  })

  it('refuses to copy a non-existent file', async () => {
    await expect(fs.cp('/foo.txt', '/bar.txt')).to.eventually.be.rejected
      .with.property('name', 'DoesNotExistError')
  })

  it('refuses to copy files to an existing file', async () => {
    const path = '/foo.txt'
    await fs.writeBytes(Uint8Array.from([0, 1, 3, 4]), path)

    await expect(fs.cp(path, path)).to.eventually.be.rejected
      .with.property('name', 'AlreadyExistsError')

    // should succeed with force option
    await expect(fs.cp(path, path, {
      force: true
    })).to.eventually.be.undefined()
  })

  it('copies a file to new location', async () => {
    const source = '/foo.txt'
    const destination = '/bar'

    const data = Uint8Array.from([0, 1, 3, 4])
    await fs.writeBytes(data, source)
    await fs.cp(source, destination)

    const bytes = await toBuffer(fs.cat(destination))

    expect(bytes).to.deep.equal(data)
  })

  it('copies directories', async () => {
    const source = '/foo'
    const destination = '/bar'

    await fs.mkdir(source)
    await fs.cp(source, destination)

    await expect(fs.stat(destination)).to.eventually.include({
      type: 'directory'
    })
  })

  it('copies a sharded directory to a normal directory', async () => {
    const shardedDirCid = await createShardedDirectory(blockstore)
    const path = '/sharded-dir'
    await fs.cp(shardedDirCid, path)

    // should still be a regular directory
    await expect(fs.stat('/')).to.eventually.have.nested.property('unixfs.type', 'directory')

    const subDirStats = await fs.stat(path)
    expect(subDirStats).to.have.nested.property('unixfs.type', 'hamt-sharded-directory')
    expect(subDirStats.cid).to.eql(shardedDirCid)
  })

  it('copies a normal directory to a sharded directory', async () => {
    const shardedDirCid = await createShardedDirectory(blockstore)
    const shardedDirPath = '/sharded-dir'
    const normalDirPath = '/normal-dir'
    const normalSubDirPath = `${shardedDirPath}/normal-dir`

    await fs.mkdir(normalDirPath)
    await fs.cp(shardedDirCid, shardedDirPath)
    await fs.cp(normalDirPath, normalSubDirPath)

    // should still be a sharded directory
    await expect(fs.stat(shardedDirPath)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    const subDirStats = await fs.stat(normalSubDirPath)
    expect(subDirStats).to.have.nested.property('unixfs.type', 'directory')
    expect(subDirStats.cid.toString()).to.equal('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354')
  })

  it('copies a file from a normal directory to a sharded directory', async () => {
    const filePath = `/file-${Math.random()}.txt`
    await fs.writeBytes(Uint8Array.from([0, 1, 3, 4]), filePath, {
      rawLeaves: false
    })

    const shardedDirCid = await createShardedDirectory(blockstore)
    const shardedDirPath = '/sharded-dir'
    await fs.cp(shardedDirCid, shardedDirPath)

    const fileInDirectoryPath = `${shardedDirPath}${filePath}`
    await fs.cp(filePath, fileInDirectoryPath)

    // should still be a sharded directory
    await expect(fs.stat(shardedDirPath)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    const fileInDirStats = await fs.stat(fileInDirectoryPath)
    expect(fileInDirStats).to.have.nested.property('unixfs.type', 'file')
    expect(fileInDirStats.cid.toString()).to.equal('bafybeibyuhrlz5wvmzhn5twibjtpofeek4v6afw3uvk6jkewrdkgivvcea')
  })

  it('refuses to copy files to an existing file in a sharded directory', async () => {
    const shardedDirCid = await createShardedDirectory(blockstore)
    const shardedDirPath = '/sharded-dir'
    await fs.cp(shardedDirCid, shardedDirPath)
    const file = await first(fs.ls(shardedDirPath))

    if (file == null) {
      throw new Error('No files listed')
    }

    await expect(fs.cp(file.cid, `${shardedDirPath}/${file.name}`)).to.eventually.be.rejected
      .with.property('name', 'AlreadyExistsError')

    // should succeed with force option
    await expect(fs.cp(file.cid, `${shardedDirPath}/${file.name}`, {
      force: true
    })).to.eventually.be.undefined()
  })

  it('copies a file to a sharded directory that creates a subshard', async () => {
    const {
      containingDirCid,
      fileName,
      importerCid
    } = await createSubshardedDirectory(blockstore)

    const shardedDirPath = '/sharded-dir'
    await fs.cp(importerCid, shardedDirPath)

    // adding a file to the importer CID should result in the shard with a subshard
    const fileCid = CID.parse('bafkreiaixnpf23vkyecj5xqispjq5ubcwgsntnnurw2bjby7khe4wnjihu')
    await fs.cp(fileCid, `${shardedDirPath}/${fileName}`)

    const stat = await fs.stat(shardedDirPath)

    expect(stat.cid.toString()).to.equal(containingDirCid.toString(), 'adding a file to the imported dir did not result in the same CID')
  })
})
