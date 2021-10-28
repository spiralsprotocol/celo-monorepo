import bodyParser from 'body-parser'
import Logger from 'bunyan'
import express from 'express'
import twilio, { Twilio } from 'twilio'
import { fetchEnv } from '../env'
import { AttestationStatus, SmsFields } from '../models/attestation'
import { readUnsupportedRegionsFromEnv, SmsProviderType } from './base'
import { receivedDeliveryReport } from './index'
import { TwilioSmsProvider } from './twilio'

export class TwilioVerifyProvider extends TwilioSmsProvider {
  static fromEnv() {
    return new TwilioVerifyProvider(
      fetchEnv('TWILIO_ACCOUNT_SID'),
      fetchEnv('TWILIO_AUTH_TOKEN'),
      readUnsupportedRegionsFromEnv('TWILIO_UNSUPPORTED_REGIONS', 'TWILIO_BLACKLIST'),
      // fetchEnv('TWILIO_MESSAGING_SERVICE_SID'),
      // TODO double check that switching this to fetchEnv doesn't break backwards compatibility
      // i.e. that this still works with no service ID
      // fetchEnvOrDefault('TWILIO_VERIFY_SERVICE_SID', ''),
      fetchEnv('TWILIO_VERIFY_SERVICE_SID')
      // TODO: this should probably go to super class
    )
  }

  client: Twilio
  // messagingServiceSid: string
  verifyServiceSid: string
  // verifyDisabledRegionCodes: string[]
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

  constructor(
    twilioSid: string,
    // TODO eval if messagingServiceId is needed?
    // messagingServiceSid: string,
    twilioAuthToken: string,
    unsupportedRegionCodes: string[],
    verifyServiceSid: string
    // verifyDisabledRegionCodes: string[],
  ) {
    // TODO fix this --> SID + Auth belong in super
    super(twilioSid, twilioAuthToken, unsupportedRegionCodes)
    this.client = twilio(twilioSid, twilioAuthToken)
    // this.messagingServiceSid = messagingServiceSid
    this.verifyServiceSid = verifyServiceSid
    // this.verifyDisabledRegionCodes = verifyDisabledRegionCodes
    // this.unsupportedRegionCodes = unsupportedRegionCodes
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
    try {
      await this.client.verify.services
        .get(this.verifyServiceSid)
        .fetch()
        .then((service) => {
          if (!service.customCodeEnabled) {
            // Make sure that custom code is enabled
            throw new Error(
              'TWILIO_VERIFY_SERVICE_SID is specified, but customCode is not enabled. Please contact Twilio support to enable it.'
            )
          }
        })
      // TODO EN double check if this is necessary for Verify API
      this.deliveryStatusURL = deliveryStatusURL
    } catch (error) {
      throw new Error(`Twilio Verify Service could not be fetched: ${error}`)
    }
    // }
  }

  async sendSms(attestation: SmsFields) {
    // Prefer Verify API if Verify Service is present and not disabled for region
    const requestParams: any = {
      to: attestation.phoneNumber,
      channel: 'sms',
      customCode: attestation.securityCode,
    }

    // This param tells Twilio to add the <#> prefix and app hash postfix
    if (attestation.appSignature) {
      requestParams.appHash = attestation.appSignature
    }
    // Normalize to locales that Twilio supports
    // If locale is not supported, Twilio API will throw an error
    if (attestation.language) {
      const locale = attestation.language.toLocaleLowerCase()
      if (['es-419', 'es-us', 'es-la'].includes(locale)) {
        attestation.language = 'es'
      }
      if (this.twilioSupportedLocales.includes(locale)) {
        requestParams.locale = locale
      }
    }
    try {
      const m = await this.client.verify
        .services(this.verifyServiceSid)
        .verifications.create(requestParams)
      return m.sid
    } catch (e) {
      // Verify landlines using voice
      if (e.message.includes('SMS is not supported by landline phone number')) {
        requestParams.appHash = undefined
        requestParams.channel = 'call'
        const m = await this.client.verify
          .services(this.verifyServiceSid)
          .verifications.create(requestParams)
        return m.sid
      } else {
        throw e
      }
    }
  }
}
