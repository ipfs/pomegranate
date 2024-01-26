/* eslint-env mocha */
import { type DAGJSON } from '@helia/dag-json'
import { type IPNS } from '@helia/ipns'
import { type JSON as HeliaJSON } from '@helia/json'
import { type UnixFS } from '@helia/unixfs'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { VerifiedFetch } from '../src/verified-fetch.js'
import type { Helia } from '@helia/interface'

const testCID = CID.parse('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')
const anyOnProgressMatcher = sinon.match.any as unknown as () => void

describe('VerifiedFetch', () => {
  it('starts and stops the helia node', async () => {
    const stopStub = sinon.stub()
    const startStub = sinon.stub()
    const verifiedFetch = new VerifiedFetch({
      helia: stubInterface<Helia>({
        start: startStub,
        stop: stopStub
      })
    })
    expect(stopStub.withArgs().callCount).to.equal(0)
    expect(startStub.withArgs().callCount).to.equal(0)
    await verifiedFetch.start()
    expect(stopStub.withArgs().callCount).to.equal(0)
    expect(startStub.withArgs().callCount).to.equal(1)
    await verifiedFetch.stop()
    expect(stopStub.withArgs().callCount).to.equal(1)
    expect(startStub.withArgs().callCount).to.equal(1)
  })

  describe('Not implemented', () => {
    let verifiedFetch: InstanceType<typeof VerifiedFetch>
    before(async () => {
      verifiedFetch = new VerifiedFetch({
        helia: stubInterface<Helia>(),
        ipns: stubInterface<IPNS>({
          resolveDns: async (dnsLink: string) => {
            expect(dnsLink).to.equal('mydomain.com')
            return testCID
          }
        }),
        unixfs: stubInterface<UnixFS>()
      })
    })
    after(async () => {
      await verifiedFetch.stop()
    })

    const formatsAndAcceptHeaders = [
      ['car', 'application/vnd.ipld.car'],
      ['tar', 'application/x-tar'],
      ['dag-json', 'application/vnd.ipld.dag-json'],
      ['dag-cbor', 'application/vnd.ipld.dag-cbor'],
      ['json', 'application/json'],
      ['cbor', 'application/cbor'],
      ['ipns-record', 'application/vnd.ipfs.ipns-record']
    ]

    for (const [format, acceptHeader] of formatsAndAcceptHeaders) {
      // eslint-disable-next-line no-loop-func
      it(`Returns 501 for ${acceptHeader}`, async () => {
        const resp = await verifiedFetch.fetch(`ipns://mydomain.com?format=${format}`)
        expect(resp).to.be.ok()
        expect(resp.status).to.equal(501)
        const resp2 = await verifiedFetch.fetch(testCID, {
          headers: {
            accept: acceptHeader
          }
        })
        expect(resp2).to.be.ok()
        expect(resp2.status).to.equal(501)
      })
    }
  })

  describe('vnd.ipld.raw', () => {
    let verifiedFetch: InstanceType<typeof VerifiedFetch>
    let unixfsStub: ReturnType<typeof stubInterface<UnixFS>>
    let dagJsonStub: ReturnType<typeof stubInterface<DAGJSON>>
    let jsonStub: ReturnType<typeof stubInterface<HeliaJSON>>
    beforeEach(async () => {
      unixfsStub = stubInterface<UnixFS>({
        cat: sinon.stub(),
        stat: sinon.stub()
      })
      dagJsonStub = stubInterface<DAGJSON>({
        // @ts-expect-error - stub errors
        get: sinon.stub()
      })
      jsonStub = stubInterface<HeliaJSON>({
        // @ts-expect-error - stub errors
        get: sinon.stub()
      })
      verifiedFetch = new VerifiedFetch({
        helia: stubInterface<Helia>(),
        ipns: stubInterface<IPNS>(),
        unixfs: unixfsStub,
        dagJson: dagJsonStub,
        json: jsonStub
      })
    })
    afterEach(async () => {
      await verifiedFetch.stop()
    })

    it('should return raw data for vnd.ipld.raw', async () => {
      const finalRootFileContent = new Uint8Array([0x01, 0x02, 0x03])
      unixfsStub.stat.returns(Promise.resolve({
        cid: testCID,
        size: 3,
        type: 'raw',
        fileSize: BigInt(3),
        dagSize: BigInt(1),
        localFileSize: BigInt(3),
        localDagSize: BigInt(1),
        blocks: 1
      }))
      unixfsStub.cat.returns({
        [Symbol.asyncIterator]: async function * () {
          yield finalRootFileContent
        }
      })
      const resp = await verifiedFetch.fetch(testCID)
      expect(unixfsStub.stat.called).to.be.true()
      expect(unixfsStub.cat.called).to.be.true()
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(200)
      const data = await resp.arrayBuffer()
      expect(new Uint8Array(data)).to.deep.equal(finalRootFileContent)
    })

    it('should look for root files when directory is returned', async () => {
      const finalRootFileContent = new Uint8Array([0x01, 0x02, 0x03])
      const signal = sinon.match.any as unknown as AbortSignal
      const onProgress = sinon.spy()
      // first stat returns a directory
      unixfsStub.stat.onCall(0).returns(Promise.resolve({
        cid: testCID,
        size: 3,
        type: 'directory',
        fileSize: BigInt(3),
        dagSize: BigInt(1),
        localFileSize: BigInt(3),
        localDagSize: BigInt(1),
        blocks: 1
      }))
      // next stat attempts to find root file index.html, let's make it fail 2 times so we can see that it tries the other root files
      unixfsStub.stat.withArgs(testCID, { path: 'index.html', signal, onProgress: anyOnProgressMatcher }).onCall(0).throws(new Error('not found'))
      unixfsStub.stat.withArgs(testCID, { path: 'index.htm', signal, onProgress: anyOnProgressMatcher }).onCall(0).throws(new Error('not found'))
      unixfsStub.stat.withArgs(testCID, { path: 'index.shtml', signal, onProgress: anyOnProgressMatcher }).onCall(0)
        .returns(Promise.resolve({
          cid: CID.parse('Qmc3zqKcwzbbvw3MQm3hXdg8BQoFjGdZiGdAfXAyAGGdLi'),
          size: 3,
          type: 'raw',
          fileSize: BigInt(3),
          dagSize: BigInt(1),
          localFileSize: BigInt(3),
          localDagSize: BigInt(1),
          blocks: 1
        }))
      unixfsStub.cat.returns({
        [Symbol.asyncIterator]: async function * () {
          yield finalRootFileContent
        }
      })
      const resp = await verifiedFetch.fetch(testCID, { onProgress })
      expect(unixfsStub.stat.callCount).to.equal(4)
      expect(unixfsStub.stat.getCall(0).args[1]).to.have.property('path', '')
      expect(unixfsStub.stat.getCall(1).args[1]).to.have.property('path', 'index.html')
      expect(unixfsStub.stat.getCall(2).args[1]).to.have.property('path', 'index.htm')
      expect(unixfsStub.stat.getCall(3).args[1]).to.have.property('path', 'index.shtml')
      expect(unixfsStub.cat.callCount).to.equal(1)
      expect(unixfsStub.cat.withArgs(testCID).callCount).to.equal(0)
      expect(unixfsStub.cat.withArgs(CID.parse('Qmc3zqKcwzbbvw3MQm3hXdg8BQoFjGdZiGdAfXAyAGGdLi'), sinon.match.any).callCount).to.equal(1)
      expect(onProgress.callCount).to.equal(11)
      const onProgressEvents = onProgress.getCalls().map(call => call.args[0])
      expect(onProgressEvents[0]).to.include({ type: 'verified-fetch:request:start' }).and.to.have.property('detail').that.deep.equals({
        cid: testCID.toString(),
        path: ''
      })
      expect(onProgressEvents[1]).to.include({ type: 'verified-fetch:request:end' }).and.to.have.property('detail').that.deep.equals({
        cid: testCID.toString(),
        path: ''
      })
      expect(onProgressEvents[9]).to.include({ type: 'verified-fetch:request:end' }).and.to.have.property('detail').that.deep.equals({
        cid: 'Qmc3zqKcwzbbvw3MQm3hXdg8BQoFjGdZiGdAfXAyAGGdLi',
        path: ''
      })
      expect(onProgressEvents[10]).to.include({ type: 'verified-fetch:request:progress:chunk' }).and.to.have.property('detail').that.is.undefined()
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(200)
      const data = await resp.arrayBuffer()
      expect(new Uint8Array(data)).to.deep.equal(finalRootFileContent)
    })

    it('should not call unixfs.cat if root file is not found', async () => {
      const signal = sinon.match.any as unknown as AbortSignal
      const onProgress = sinon.spy()
      // first stat returns a directory
      unixfsStub.stat.onCall(0).returns(Promise.resolve({
        cid: testCID,
        size: 3,
        type: 'directory',
        fileSize: BigInt(3),
        dagSize: BigInt(1),
        localFileSize: BigInt(3),
        localDagSize: BigInt(1),
        blocks: 1
      }))

      unixfsStub.stat.withArgs(testCID, { path: 'index.html', signal, onProgress: anyOnProgressMatcher }).onCall(0).throws(new Error('not found'))
      unixfsStub.stat.withArgs(testCID, { path: 'index.htm', signal, onProgress: anyOnProgressMatcher }).onCall(0).throws(new Error('not found'))
      unixfsStub.stat.withArgs(testCID, { path: 'index.shtml', signal, onProgress: anyOnProgressMatcher }).onCall(0).throws(new Error('not found'))
      const resp = await verifiedFetch.fetch(testCID)

      expect(unixfsStub.stat.withArgs(testCID).callCount).to.equal(4)
      expect(unixfsStub.stat.withArgs(testCID, { path: 'index.html', signal, onProgress: anyOnProgressMatcher }).callCount).to.equal(1)
      expect(unixfsStub.stat.withArgs(testCID, { path: 'index.htm', signal, onProgress: anyOnProgressMatcher }).callCount).to.equal(1)
      expect(unixfsStub.stat.withArgs(testCID, { path: 'index.shtml', signal, onProgress: anyOnProgressMatcher }).callCount).to.equal(1)
      expect(unixfsStub.cat.withArgs(testCID).callCount).to.equal(0)
      expect(onProgress.callCount).to.equal(0)
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(501)
    })

    it('should return dag-json encoded CID', async () => {
      const abortSignal = new AbortController().signal
      const onProgress = sinon.spy()
      const cid = CID.parse('baguqeerasords4njcts6vs7qvdjfcvgnume4hqohf65zsfguprqphs3icwea')
      dagJsonStub.get.withArgs(cid).returns(Promise.resolve({
        hello: 'world'
      }))
      const resp = await verifiedFetch.fetch(cid, {
        signal: abortSignal,
        onProgress
      })
      expect(unixfsStub.stat.withArgs(cid).callCount).to.equal(0)
      expect(unixfsStub.cat.withArgs(cid).callCount).to.equal(0)
      expect(dagJsonStub.get.withArgs(cid).callCount).to.equal(1)
      expect(onProgress.callCount).to.equal(2)
      const onProgressEvents = onProgress.getCalls().map(call => call.args[0])
      expect(onProgressEvents[0]).to.have.property('type', 'verified-fetch:request:start')
      expect(onProgressEvents[0]).to.have.property('detail').that.deep.equals({
        cid: cid.toString(),
        path: ''
      })
      expect(onProgressEvents[1]).to.have.property('type', 'verified-fetch:request:end')
      expect(onProgressEvents[1]).to.have.property('detail').that.deep.equals({
        cid: cid.toString(),
        path: ''
      })
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(200)
      const data = await resp.json()
      expect(data).to.deep.equal({
        hello: 'world'
      })
    })

    it('should return json encoded CID', async () => {
      const abortSignal = new AbortController().signal
      const onProgress = sinon.spy()
      const cid = CID.parse('bagaaifcavabu6fzheerrmtxbbwv7jjhc3kaldmm7lbnvfopyrthcvod4m6ygpj3unrcggkzhvcwv5wnhc5ufkgzlsji7agnmofovc2g4a3ui7ja')
      jsonStub.get.withArgs(cid).returns(Promise.resolve({
        hello: 'world'
      }))
      const resp = await verifiedFetch.fetch(cid, {
        signal: abortSignal,
        onProgress
      })
      expect(unixfsStub.stat.withArgs(cid).callCount).to.equal(0)
      expect(unixfsStub.cat.withArgs(cid).callCount).to.equal(0)
      expect(dagJsonStub.get.withArgs(cid).callCount).to.equal(0)
      expect(jsonStub.get.withArgs(cid).callCount).to.equal(1)
      const onProgressEvents = onProgress.getCalls().map(call => call.args[0])
      expect(onProgressEvents[0]).to.have.property('type', 'verified-fetch:request:start')
      expect(onProgressEvents[0]).to.have.property('detail').that.deep.equals({
        cid: cid.toString(),
        path: ''
      })
      expect(onProgressEvents[1]).to.have.property('type', 'verified-fetch:request:end')
      expect(onProgressEvents[1]).to.have.property('detail').that.deep.equals({
        cid: cid.toString(),
        path: ''
      })
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(200)
      const data = await resp.json()
      expect(data).to.deep.equal({
        hello: 'world'
      })
    })
  })
})
