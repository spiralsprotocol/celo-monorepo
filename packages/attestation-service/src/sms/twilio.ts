import bodyParser from 'body-parser'
import Logger from 'bunyan'
import express from 'express'
import twilio, { Twilio } from 'twilio'
import { fetchEnv } from '../env'
import { AttestationStatus, SmsFields } from '../models/attestation'
import { readUnsupportedRegionsFromEnv, SmsProvider, SmsProviderType } from './base'
import { receivedDeliveryReport } from './index'

export class TwilioSmsProvider extends SmsProvider {
  static fromEnv() {
    return new TwilioSmsProvider(
      fetchEnv('TWILIO_ACCOUNT_SID'),
      fetchEnv('TWILIO_AUTH_TOKEN'),
      readUnsupportedRegionsFromEnv('TWILIO_UNSUPPORTED_REGIONS', 'TWILIO_BLACKLIST')
    )
  }

  client: Twilio
  type = SmsProviderType.TWILIO
  deliveryStatusURL: string | undefined
  // https://www.twilio.com/docs/verify/api/verification#start-new-verification
  twilioSupportedLocales = [
    'af',
    'ar',
    'ca',
    'cs',
    'da',
    'de',
    'el',
    'en',
    'en-gb',
    'es',
    'fi',
    'fr',
    'he',
    'hi',
    'hr',
    'hu',
    'id',
    'it',
    'ja',
    'ko',
    'ms',
    'nb',
    'nl',
    'pl',
    'pt',
    'pr-br',
    'ro',
    'ru',
    'sv',
    'th',
    'tl',
    'tr',
    'vi',
    'zh',
    'zh-cn',
    'zh-hk',
  ]

  constructor(twilioSid: string, twilioAuthToken: string, unsupportedRegionCodes: string[]) {
    super()
    this.client = twilio(twilioSid, twilioAuthToken)
    this.unsupportedRegionCodes = unsupportedRegionCodes
  }

  async receiveDeliveryStatusReport(req: express.Request, logger: Logger) {
    await receivedDeliveryReport(
      req.body.MessageSid,
      this.deliveryStatus(req.body.MessageStatus),
      req.body.ErrorCode,
      logger
    )
  }

  deliveryStatus(messageStatus: string | null): AttestationStatus {
    switch (messageStatus) {
      case 'delivered':
        return AttestationStatus.Delivered
      case 'failed':
        return AttestationStatus.Failed
      case 'undelivered':
        return AttestationStatus.Failed
      case 'sent':
        return AttestationStatus.Upstream
      case 'queued':
        return AttestationStatus.Queued
    }
    return AttestationStatus.Other
  }

  deliveryStatusMethod = () => 'POST'

  deliveryStatusHandlers() {
    return [
      bodyParser.urlencoded({ extended: false }),
      twilio.webhook({ url: this.deliveryStatusURL! }),
    ]
  }

  async initialize(deliveryStatusURL?: string) {
    // Ensure the messaging service exists
    this.deliveryStatusURL = deliveryStatusURL
  }

  async sendSms(_attestation: SmsFields): Promise<string> {
    throw new Error('Not implemented')
  }
}
