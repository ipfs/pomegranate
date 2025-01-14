/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { identity } from 'multiformats/hashes/identity'
import { strings, type Strings } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

describe('get', () => {
  let blockstore: Blockstore
  let str: Strings
  let cid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    str = strings({ blockstore })
    cid = await str.add('hello world')
  })

  it('gets a string', async () => {
    const string = await str.get(cid)

    expect(`${string}`).to.equal('hello world')
  })

  it('gets a string with a non-default hashing algorithm', async () => {
    const input = 'hello world'
    const cid = await str.add(input, {
      hasher: identity
    })

    await expect(str.get(cid)).to.eventually.equal(input)
  })
})
