/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */

import { encodeMessage, decodeMessage, message, enumeration } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'
import type { Codec } from 'protons-runtime'

export interface RPCCallRequest {
  user: string
  resource: string
  method: string
  authorization: string
  options: Uint8Array
}

export namespace RPCCallRequest {
  let _codec: Codec<RPCCallRequest>

  export const codec = (): Codec<RPCCallRequest> => {
    if (_codec == null) {
      _codec = message<RPCCallRequest>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || obj.user !== '') {
          w.uint32(10)
          w.string(obj.user)
        }

        if (opts.writeDefaults === true || obj.resource !== '') {
          w.uint32(18)
          w.string(obj.resource)
        }

        if (opts.writeDefaults === true || obj.method !== '') {
          w.uint32(26)
          w.string(obj.method)
        }

        if (opts.writeDefaults === true || obj.authorization !== '') {
          w.uint32(34)
          w.string(obj.authorization)
        }

        if (opts.writeDefaults === true || (obj.options != null && obj.options.byteLength > 0)) {
          w.uint32(42)
          w.bytes(obj.options)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          user: '',
          resource: '',
          method: '',
          authorization: '',
          options: new Uint8Array(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.user = reader.string()
              break
            case 2:
              obj.resource = reader.string()
              break
            case 3:
              obj.method = reader.string()
              break
            case 4:
              obj.authorization = reader.string()
              break
            case 5:
              obj.options = reader.bytes()
              break
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: RPCCallRequest): Uint8Array => {
    return encodeMessage(obj, RPCCallRequest.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): RPCCallRequest => {
    return decodeMessage(buf, RPCCallRequest.codec())
  }
}

export interface RPCCallResponse {
  type: RPCCallResponseType
  message?: Uint8Array
  errorName?: string
  errorMessage?: string
  errorStack?: string
  errorCode?: string
}

export namespace RPCCallResponse {
  let _codec: Codec<RPCCallResponse>

  export const codec = (): Codec<RPCCallResponse> => {
    if (_codec == null) {
      _codec = message<RPCCallResponse>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || (obj.type != null && __RPCCallResponseTypeValues[obj.type] !== 0)) {
          w.uint32(8)
          RPCCallResponseType.codec().encode(obj.type, w)
        }

        if (obj.message != null) {
          w.uint32(18)
          w.bytes(obj.message)
        }

        if (obj.errorName != null) {
          w.uint32(26)
          w.string(obj.errorName)
        }

        if (obj.errorMessage != null) {
          w.uint32(34)
          w.string(obj.errorMessage)
        }

        if (obj.errorStack != null) {
          w.uint32(42)
          w.string(obj.errorStack)
        }

        if (obj.errorCode != null) {
          w.uint32(50)
          w.string(obj.errorCode)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          type: RPCCallResponseType.message
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.type = RPCCallResponseType.codec().decode(reader)
              break
            case 2:
              obj.message = reader.bytes()
              break
            case 3:
              obj.errorName = reader.string()
              break
            case 4:
              obj.errorMessage = reader.string()
              break
            case 5:
              obj.errorStack = reader.string()
              break
            case 6:
              obj.errorCode = reader.string()
              break
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: RPCCallResponse): Uint8Array => {
    return encodeMessage(obj, RPCCallResponse.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): RPCCallResponse => {
    return decodeMessage(buf, RPCCallResponse.codec())
  }
}

export enum RPCCallResponseType {
  message = 'message',
  error = 'error'
}

enum __RPCCallResponseTypeValues {
  message = 0,
  error = 1
}

export namespace RPCCallResponseType {
  export const codec = (): Codec<RPCCallResponseType> => {
    return enumeration<RPCCallResponseType>(__RPCCallResponseTypeValues)
  }
}
