/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { CID } from 'multiformats/cid'
import { identity } from 'multiformats/hashes/identity'
import { json, type JSON } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'

describe('get', () => {
  let blockstore: Blockstore
  let j: JSON
  let cid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    j = json({ blockstore })
    cid = await j.add({
      hello: 'world'
    })
  })

  it('gets an object', async () => {
    const result = await j.get(cid)

    expect(result).to.deep.equal({
      hello: 'world'
    })
  })

  it('gets an object with a non-default hashing algorithm', async () => {
    const input = {
      hello: 'world'
    }
    const cid = await j.add(input, {
      hasher: identity
    })

    await expect(j.get(cid)).to.eventually.deep.equal(input)
  })

  it('rejects if CID codec is not equal to JSON codec', async () => {
    const rawCID = CID.createV1(0x55, cid.multihash)
    await expect(j.get(rawCID)).to.eventually.be.rejected
      .with.property('message', 'The passed CID had an incorrect codec, it may correspond to a non-JSON block')
  })
})
