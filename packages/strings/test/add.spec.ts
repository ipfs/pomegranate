/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { identity } from 'multiformats/hashes/identity'
import { strings, type Strings } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'

describe('put', () => {
  let blockstore: Blockstore
  let str: Strings

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    str = strings({ blockstore })
  })

  it('adds a string', async () => {
    const cid = await str.add('hello world')

    expect(`${cid}`).to.equal('bafkreifzjut3te2nhyekklss27nh3k72ysco7y32koao5eei66wof36n5e')
  })

  it('adds a string with a non-default hashing algorithm', async () => {
    const cid = await str.add('hello world', {
      hasher: identity
    })

    expect(`${cid}`).to.equal('bafkqac3imvwgy3zao5xxe3de')
  })
})
