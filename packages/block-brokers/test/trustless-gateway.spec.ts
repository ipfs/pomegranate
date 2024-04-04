/* eslint-env mocha */

import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import * as raw from 'multiformats/codecs/raw'
import Sinon from 'sinon'
import { type StubbedInstance, stubConstructor } from 'sinon-ts'
import { TrustlessGatewayBlockBroker } from '../src/trustless-gateway/broker.js'
import { TrustlessGateway } from '../src/trustless-gateway/trustless-gateway.js'
import { createBlock } from './fixtures/create-block.js'
import type { BlockBroker } from '@helia/interface/blocks'
import type { CID } from 'multiformats/cid'

describe('trustless-gateway-block-broker', () => {
  let blocks: Array<{ cid: CID, block: Uint8Array }>
  let gatewayBlockBroker: BlockBroker
  let gateways: Array<StubbedInstance<TrustlessGateway>>

  // take a Record<gatewayIndex, (gateway: StubbedInstance<TrustlessGateway>) => void> and stub the gateways
  // Record.default is the default handler
  function stubGateways (handlers: Record<number, (gateway: StubbedInstance<TrustlessGateway>, index?: number) => void> & { default(gateway: StubbedInstance<TrustlessGateway>, index: number): void }): void {
    for (let i = 0; i < gateways.length; i++) {
      if (handlers[i] != null) {
        handlers[i](gateways[i])
        continue
      }
      handlers.default(gateways[i], i)
    }
  }

  beforeEach(async () => {
    blocks = []

    for (let i = 0; i < 10; i++) {
      blocks.push(await createBlock(raw.code, Uint8Array.from([0, 1, 2, i])))
    }

    gateways = [
      stubConstructor(TrustlessGateway, 'http://localhost:8080'),
      stubConstructor(TrustlessGateway, 'http://localhost:8081', { subdomainResolution: true }),
      stubConstructor(TrustlessGateway, 'http://localhost:8082'),
      stubConstructor(TrustlessGateway, 'http://localhost:8083')
    ]
    gatewayBlockBroker = new TrustlessGatewayBlockBroker({
      logger: defaultLogger()
    })
    // must copy the array because the broker calls .sort which mutates in-place
    ;(gatewayBlockBroker as any).gateways = [...gateways]
  })

  it('tries all gateways before failing', async () => {
    // stub all gateway responses to fail
    for (const gateway of gateways) {
      gateway.getRawBlock.rejects(new Error('failed'))
    }

    await expect(gatewayBlockBroker.retrieve?.(blocks[0].cid))
      .to.eventually.be.rejected()
      .with.property('errors')
      .with.lengthOf(gateways.length)

    for (const gateway of gateways) {
      expect(gateway.getRawBlock.calledWith(blocks[0].cid)).to.be.true()
    }
  })

  it('prioritizes gateways based on reliability', async () => {
    const callOrder: number[] = []

    // stub all gateway responses to fail, and set reliabilities to known values.
    stubGateways({
      default: (gateway, i) => {
        gateway.getRawBlock.withArgs(blocks[1].cid, Sinon.match.any).callsFake(async () => {
          callOrder.push(i)
          throw new Error('failed')
        })
        gateway.reliability.returns(i) // known reliability of 0, 1, 2, 3
      }
    })

    await expect(gatewayBlockBroker.retrieve?.(blocks[1].cid)).to.eventually.be.rejected()

    // all gateways were called
    expect(gateways[0].getRawBlock.calledWith(blocks[1].cid)).to.be.true()
    expect(gateways[1].getRawBlock.calledWith(blocks[1].cid)).to.be.true()
    expect(gateways[2].getRawBlock.calledWith(blocks[1].cid)).to.be.true()
    expect(gateways[3].getRawBlock.calledWith(blocks[1].cid)).to.be.true()
    // and in the correct order.
    expect(callOrder).to.have.ordered.members([3, 2, 1, 0])
  })

  it('tries other gateways if it receives invalid blocks', async () => {
    const { cid: cid1, block: block1 } = blocks[0]
    const { block: block2 } = blocks[1]
    stubGateways({
      // return valid block for only one gateway
      0: (gateway) => {
        gateway.getRawBlock.withArgs(cid1, Sinon.match.any).resolves(block1)
        gateway.reliability.returns(0) // make sure it's called last
      },
      // return invalid blocks for all other gateways
      default: (gateway) => { // default stub function
        gateway.getRawBlock.withArgs(cid1, Sinon.match.any).resolves(block2) // invalid block for the CID
        gateway.reliability.returns(1) // make sure other gateways are called first
      }
    })

    const block = await gatewayBlockBroker.retrieve?.(cid1, {
      validateFn: async (block) => {
        if (block !== block1) {
          throw new Error('invalid block')
        }
      }
    })
    expect(block).to.equal(block1)

    // expect that all gateways are called, because everyone returned invalid blocks except the last one
    for (const gateway of gateways) {
      expect(gateway.getRawBlock.calledWith(cid1, Sinon.match.any)).to.be.true()
    }
  })

  it('does not call other gateways if the first gateway returns a valid block', async () => {
    const { cid: cid1, block: block1 } = blocks[0]
    const { block: block2 } = blocks[1]

    stubGateways({
      // return valid block for only one gateway
      3: (gateway) => {
        gateway.getRawBlock.withArgs(cid1, Sinon.match.any).resolves(block1)
        gateway.reliability.returns(1) // make sure it's called first
      },
      // return invalid blocks for all other gateways
      default: (gateway) => { // default stub function
        gateway.getRawBlock.withArgs(cid1, Sinon.match.any).resolves(block2) // invalid block for the CID
        gateway.reliability.returns(0) // make sure other gateways are called last
      }
    })
    const block = await gatewayBlockBroker.retrieve?.(cid1, {
      validateFn: async (block) => {
        if (block !== block1) {
          throw new Error('invalid block')
        }
      }
    })
    expect(block).to.equal(block1)
    expect(gateways[3].getRawBlock.calledWith(cid1, Sinon.match.any)).to.be.true()
    // expect that other gateways are not called, because the first gateway returned a valid block
    expect(gateways[0].getRawBlock.calledWith(cid1, Sinon.match.any)).to.be.false()
    expect(gateways[1].getRawBlock.calledWith(cid1, Sinon.match.any)).to.be.false()
    expect(gateways[2].getRawBlock.calledWith(cid1, Sinon.match.any)).to.be.false()
  })

  it('constructs the gateway url for the cid for both path and subdomain gateways', async () => {
    const pathGw = new TrustlessGateway('http://localhost:8080')
    const subdomainGw = new TrustlessGateway('https://dweb.link', { subdomainResolution: true })

    expect(pathGw.getGwUrl(blocks[0].cid).hostname).to.equal('localhost')
    expect(pathGw.getGwUrl(blocks[0].cid).toString()).to.equal('http://localhost:8080/ipfs/bafkreiefnkxuhnq3536qo2i2w3tazvifek4mbbzb6zlq3ouhprjce5c3aq')
    expect(pathGw.getGwUrl(blocks[1].cid).toString()).to.equal(`http://localhost:8080/ipfs/${blocks[1].cid.toString()}`)

    expect(subdomainGw.getGwUrl(blocks[0].cid).hostname).to.equal('bafkreiefnkxuhnq3536qo2i2w3tazvifek4mbbzb6zlq3ouhprjce5c3aq.ipfs.dweb.link')
    expect(subdomainGw.getGwUrl(blocks[0].cid).toString()).to.equal('https://bafkreiefnkxuhnq3536qo2i2w3tazvifek4mbbzb6zlq3ouhprjce5c3aq.ipfs.dweb.link/')
    expect(subdomainGw.getGwUrl(blocks[1].cid).toString()).to.equal(`https://${blocks[1].cid.toString()}.ipfs.dweb.link/`)
  })
})
