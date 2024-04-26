import { cryptoApi, storeApi } from '../../../src/external'
import { checkIfLicenseIsValid, extractLicenseInfo, getAiApiSignature } from '../../../src/frontend/api'
import fs from 'fs'

describe('api', () => {
  it('extractPublicKey', async () => {
    const signature = [
      'EE23Rboqr16LKsFjIXwleYwrUs7nxTF7AZ6iOXF2ji5pkDLVeTfjGVhVJeTMMPXc',
      'P5AI9S8dx6252B6JkrZfJ43b9F7qghcqN+vZ38+3rzzYLsNC3Rl0TDDaesHI8fnz',
      'uCLvs+fFmn48RBy+ffHRDv8lyB4HvVwL61XBVE2yO6o='
    ].join('\n')
    const expired = '2022-07-31T02:16:32.579864'
    const license = `---- Superintendent license ----
Name: Tanin
Email: tanin47@gmail.com
Expired: ${expired}
Signature:
${signature}
---- End of Superintendent license ----`

    await expect(extractLicenseInfo(license, 'Signature')).toEqual(signature)
    await expect(extractLicenseInfo(license, 'Expired')).toEqual(expired)
  })

  it('validates the license key correctly', async () => {
    (window as any).cryptoApi = cryptoApi;
    (window as any).storeApi = storeApi

    jest.useFakeTimers().setSystemTime(new Date('2022-07-23'))
    const contract = JSON.parse(fs.readFileSync('./test/frontend/api/contract/license.json').toString()) as { licenseKey: string }

    await expect(checkIfLicenseIsValid(contract.licenseKey)).toStrictEqual({ success: true })
    await expect(checkIfLicenseIsValid(contract.licenseKey.replace('tanin', 'tnn'))).toStrictEqual({
      success: false,
      errorMessage: 'The license key is not valid. Please contact support@superintendent.app.'
    })
    // Expire
    jest.useFakeTimers().setSystemTime(new Date('2022-08-30'))
    await expect(checkIfLicenseIsValid(contract.licenseKey)).toStrictEqual({
      success: false,
      errorMessage: 'The license key has expired. Please buy a new license at superintendent.app.'
    })
  })

  it('signs a signature for the AI endpoint', async () => {
    (window as any).cryptoApi = cryptoApi

    const contract = JSON.parse(fs.readFileSync('./test/frontend/api/contract/ai_api_signature.json').toString()) as { body: string, timestamp: string, user: string, signature: string }

    const signature = getAiApiSignature(contract.body, contract.timestamp, contract.user)
    await expect(signature).toStrictEqual(contract.signature)
  })
})
