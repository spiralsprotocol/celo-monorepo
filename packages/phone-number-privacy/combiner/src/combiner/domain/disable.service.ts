import {
  CombinerEndpoint,
  DisableDomainRequest,
  disableDomainRequestSchema,
  DisableDomainResponseSuccess,
  Domain,
  DomainSchema,
  ErrorMessage,
  ErrorType,
  getSignerEndpoint,
  respondWithError,
  SignerEndpoint,
  verifyDisableDomainRequestAuthenticity,
} from '@celo/phone-number-privacy-common'
import { Request } from 'express'
import { OdisConfig, VERSION } from '../../config'
import { CombinerService } from '../combiner.service'
import { Session } from '../session'

export class DomainDisableService extends CombinerService<DisableDomainRequest> {
  readonly endpoint: CombinerEndpoint
  readonly signerEndpoint: SignerEndpoint

  public constructor(config: OdisConfig) {
    super(config)
    this.endpoint = CombinerEndpoint.DISABLE_DOMAIN
    this.signerEndpoint = getSignerEndpoint(this.endpoint)
  }

  protected validate(
    request: Request<{}, {}, unknown>
  ): request is Request<{}, {}, DisableDomainRequest> {
    return disableDomainRequestSchema(DomainSchema).is(request.body)
  }

  protected authenticate(request: Request<{}, {}, DisableDomainRequest<Domain>>): Promise<boolean> {
    return Promise.resolve(verifyDisableDomainRequestAuthenticity(request.body))
  }

  protected reqKeyHeaderCheck(_request: Request<{}, {}, DisableDomainRequest>): boolean {
    return true // does not require key header
  }

  protected async handleResponseOK(
    data: string,
    status: number,
    url: string,
    session: Session<DisableDomainRequest>
  ): Promise<void> {
    const res = JSON.parse(data)

    if (!res.success) {
      session.logger.error({ error: res.error, signer: url }, 'Signer responded with error')
      throw new Error(`Signer request to ${url}/${this.signerEndpoint} request failed`)
    }

    session.logger.info({ signer: url }, `Signer request successful`)
    session.responses.push({ url, res, status })

    if (session.responses.length >= this.threshold) {
      session.controller.abort()
    }
  }

  protected sendSuccessResponse(
    res: DisableDomainResponseSuccess,
    status: number,
    session: Session<DisableDomainRequest>
  ) {
    session.response.status(status).json(res)
  }

  protected sendFailureResponse(
    error: ErrorType,
    status: number,
    session: Session<DisableDomainRequest>
  ): void {
    // TODO(Alec)
    respondWithError(
      session.response,
      {
        success: false,
        version: VERSION,
        error,
      },
      status,
      session.logger
    )
  }

  protected async combine(session: Session<DisableDomainRequest>): Promise<void> {
    if (session.responses.length >= this.threshold) {
      this.sendSuccessResponse(
        {
          success: true,
          version: VERSION,
        },
        200,
        session
      ) // A
      return
    }

    this.sendFailureResponse(
      ErrorMessage.THRESHOLD_DISABLE_DOMAIN_FAILURE,
      session.getMajorityErrorCode() ?? 500, // B
      session
    )
  }
}
