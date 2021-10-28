import { fetchEnv } from '../env'
import { SmsFields } from '../models/attestation'
import { readUnsupportedRegionsFromEnv, SmsProviderType } from './base'
import { TwilioSmsProvider } from './twilio'

export class TwilioMessagingProvider extends TwilioSmsProvider {
  static fromEnv() {
    return new TwilioMessagingProvider(
      fetchEnv('TWILIO_ACCOUNT_SID'),
      fetchEnv('TWILIO_AUTH_TOKEN'),
      readUnsupportedRegionsFromEnv('TWILIO_UNSUPPORTED_REGIONS', 'TWILIO_BLACKLIST'),
      fetchEnv('TWILIO_MESSAGING_SERVICE_SID')
    )
  }

  messagingServiceSid: string
  type = SmsProviderType.TWILIO

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
    twilioAuthToken: string,
    unsupportedRegionCodes: string[],
    messagingServiceSid: string
  ) {
    super(twilioSid, twilioAuthToken, unsupportedRegionCodes)
    this.messagingServiceSid = messagingServiceSid
  }

  async initialize(deliveryStatusURL?: string) {
    // Ensure the messaging service exists
    try {
      await this.client.messaging.services.get(this.messagingServiceSid).fetch()
      super.initialize(deliveryStatusURL)
    } catch (error) {
      throw new Error(`Twilio Messaging Service could not be fetched: ${error}`)
    }
  }

  async sendSms(attestation: SmsFields) {
    const m = await this.client.messages.create({
      body: attestation.message,
      to: attestation.phoneNumber,
      from: this.messagingServiceSid,
      statusCallback: this.deliveryStatusURL,
    })
    return m.sid
  }
}
