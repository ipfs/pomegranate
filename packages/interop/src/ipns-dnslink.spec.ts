/* eslint-env mocha */

import { ipns } from '@helia/ipns'
import { expect } from 'aegir/chai'
import { createHeliaNode } from './fixtures/create-helia.js'
import type { IPNS } from '@helia/ipns'
import type { HeliaLibp2p } from 'helia'

const TEST_DOMAINS: string[] = [
  'ipfs.io',
  'docs.ipfs.tech',
  'en.wikipedia-on-ipfs.org',
  'blog.libp2p.io',
  'consensuslab.world',
  'n0.computer',
  'protocol.ai',
  'research.protocol.ai',
  'probelab.io',
  'singularity.storage',
  'saturn.tech'
]

describe('@helia/ipns - dnslink', () => {
  let helia: HeliaLibp2p
  let name: IPNS

  beforeEach(async () => {
    helia = await createHeliaNode()
    name = ipns(helia)
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  TEST_DOMAINS.forEach(domain => {
    it(`should resolve ${domain}`, async () => {
      const result = await name.resolveDNSLink(domain)

      expect(result).to.have.property('cid')
    }).retries(5)
  })
})
