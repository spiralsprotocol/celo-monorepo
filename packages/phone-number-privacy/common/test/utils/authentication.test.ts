import { Request } from 'express'
import Logger from 'bunyan'

import * as auth from '../../src/utils/authentication'
import { ContractKit } from '@celo/contractkit'
import { AuthenticationMethod } from '@celo/identity/lib/odis/query'
import { DomainQuotaStatusRequest } from '../../src/interfaces'
import { SequentialDelayDomain } from '@celo/identity/lib/odis/domains'
import { defined, noBool, noString } from '@celo/utils/lib/sign-typed-data-utils'

describe('Authentication test suite', () => {
  const logger = Logger.createLogger({
    name: 'logger',
    level: 'warn',
  })

  describe('authenticateUser utility', () => {
    it("Should fail authentication with missing 'Authorization' header", async () => {
      const sampleRequest: Request = {
        get: (_: string) => '',
        body: {
          account: '0xc1912fee45d61c87cc5ea59dae31190fffff232d',
        },
      } as Request
      const mockContractKit = {} as ContractKit

      const result = await auth.authenticateUser(sampleRequest, mockContractKit, logger)

      expect(result).toBeFalsy()
    })

    it('Should fail authentication with missing signer', async () => {
      const sampleRequest: Request = {
        get: (name: string) => (name === 'Authorization' ? 'Test' : ''),
        body: {},
      } as Request
      const mockContractKit = {} as ContractKit

      const result = await auth.authenticateUser(sampleRequest, mockContractKit, logger)

      expect(result).toBeFalsy()
    })

    it('Should succeed authentication with error in getDataEncryptionKey', async () => {
      const sampleRequest: Request = {
        get: (name: string) => (name === 'Authorization' ? 'Test' : ''),
        body: {
          account: '0xc1912fee45d61c87cc5ea59dae31190fffff232d',
          authenticationMethod: AuthenticationMethod.ENCRYPTION_KEY,
        },
      } as Request
      const mockContractKit = {} as ContractKit

      const result = await auth.authenticateUser(sampleRequest, mockContractKit, logger)

      expect(result).toBeTruthy()
    })

    it('Should fail authentication when key is not registered', async () => {
      const sampleRequest: Request = {
        get: (name: string) => (name === 'Authorization' ? 'Test' : ''),
        body: {
          account: '0xc1912fee45d61c87cc5ea59dae31190fffff232d',
          authenticationMethod: AuthenticationMethod.ENCRYPTION_KEY,
        },
      } as Request
      const mockContractKit = {
        contracts: {
          getAccounts: async () => {
            return Promise.resolve({
              getDataEncryptionKey: async (_: string) => {
                return ''
              },
            })
          },
        },
      } as ContractKit

      const result = await auth.authenticateUser(sampleRequest, mockContractKit, logger)

      expect(result).toBeFalsy()
    })

    it('Should fail authentication when key is registered but not valid', async () => {
      const sampleRequest: Request = {
        get: (name: string) => (name === 'Authorization' ? 'Test' : ''),
        body: {
          account: '0xc1912fee45d61c87cc5ea59dae31190fffff232d',
          authenticationMethod: AuthenticationMethod.ENCRYPTION_KEY,
        },
      } as Request
      const mockContractKit = {
        contracts: {
          getAccounts: async () => {
            return Promise.resolve({
              getDataEncryptionKey: async (_: string) => {
                return 'notAValidKeyEncryption'
              },
            })
          },
        },
      } as ContractKit

      const result = await auth.authenticateUser(sampleRequest, mockContractKit, logger)

      expect(result).toBeFalsy()
    })
  })

  describe('authenticateDomain utility', () => {
    it('Should fail authentication with missing signer', async () => {
      const domainRequest: DomainQuotaStatusRequest<SequentialDelayDomain> = {
        domain: {
          name: 'ODIS Sequential Delay Domain',
          version: '1',
          stages: [
            { delay: 0, resetTimer: noBool, batchSize: defined(2), repetitions: defined(10) },
          ],
          address: noString,
          salt: noString,
        },
        options: {
          signature: defined('<signature>'),
          nonce: defined(2),
        },
        sessionID: noString,
      }
      const request = {
        get: (_: string) => '',
        body: domainRequest,
      } as Request<DomainQuotaStatusRequest>

      const result = await auth.authenticateDomain(request, logger)

      expect(result).toBeFalsy()
    })

    it('Should fail authentication with missing signature', async () => {
      const domainRequest: DomainQuotaStatusRequest<SequentialDelayDomain> = {
        domain: {
          name: 'ODIS Sequential Delay Domain',
          version: '1',
          stages: [
            { delay: 0, resetTimer: noBool, batchSize: defined(2), repetitions: defined(10) },
          ],
          address: defined('0x0000000000000000000000000000000000000b0b'),
          salt: noString,
        },
        options: {
          signature: noString,
          nonce: defined(2),
        },
        sessionID: noString,
      }
      const request = {
        get: (_: string) => '',
        body: domainRequest,
      } as Request<DomainQuotaStatusRequest>

      const result = await auth.authenticateDomain(request, logger)

      expect(result).toBeFalsy()
    })
  })

  describe('isVerified utility', () => {
    it('Should succeed when verification is ok', async () => {
      const mockContractKit = {
        contracts: {
          getAttestations: async () => {
            return {
              getVerifiedStatus: async (_: string, __: string) => {
                return {
                  isVerified: true,
                }
              },
            }
          },
        },
      } as ContractKit

      const result = await auth.isVerified('', '', mockContractKit, logger)

      expect(result).toBeTruthy()
    })
    it('Should fail when verification is not ok', async () => {
      const mockContractKit = {
        contracts: {
          getAttestations: async () => {
            return {
              getVerifiedStatus: async (_: string, __: string) => {
                return {
                  isVerified: false,
                }
              },
            }
          },
        },
      } as ContractKit

      const result = await auth.isVerified('', '', mockContractKit, logger)

      expect(result).toBeFalsy()
    })
  })
})
