import {checkIfLicenseIsValid, extractLicenseInfo, verifyExpiredAt, verifySignature} from '../../../src/frontend/api';
import fs from 'fs';

describe('api', () => {
  it('extractPublicKey', () => {
    const publicKey = [
      'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDq1CPIZIySiU31CGhezrVWey8x',
      '6R+FBPhUlEpvnz9y6ymIteKHAn/lHbqLz51TTZOb7KTdTq5NEYS4h5zYvhg9U1r9',
      'Ipvg7H5cYVWj1/Pl+xqoQwEMKv8OED9THWUdV5QWaH8Sh1FujFUoxCccKMlGncy7',
      'Ib4GUvBOn8ZPIDRD4wIDAQAB'
    ].join('\n');
    const signature = [
      'EE23Rboqr16LKsFjIXwleYwrUs7nxTF7AZ6iOXF2ji5pkDLVeTfjGVhVJeTMMPXc',
      'P5AI9S8dx6252B6JkrZfJ43b9F7qghcqN+vZ38+3rzzYLsNC3Rl0TDDaesHI8fnz',
      'uCLvs+fFmn48RBy+ffHRDv8lyB4HvVwL61XBVE2yO6o='
    ].join('\n');
    const expired = '2022-07-31T02:16:32.579864';
    const license = `---- Superintendent license ----
Name: Tanin
Email: tanin47@gmail.com
Expired: ${expired}
Key:
${publicKey}
Signature:
${signature}
---- End of Superintendent license ----`;

    expect(extractLicenseInfo(license, 'Key')).toEqual(publicKey);
    expect(extractLicenseInfo(license, 'Signature')).toEqual(signature);
    expect(extractLicenseInfo(license, 'Expired')).toEqual(expired);
  });

  it('validates the license key correctly', () => {
    jest.useFakeTimers().setSystemTime(new Date('2022-07-23'));
    const contract = JSON.parse(fs.readFileSync('./test/frontend/api/contract/license.json').toString());

    expect(checkIfLicenseIsValid(contract.licenseKey)).toStrictEqual({success: true});
    expect(checkIfLicenseIsValid(contract.licenseKey.replace('tanin', 'tnn'))).toStrictEqual({
      success: false,
      errorMessage: 'The license key is not valid. Please contact support@superintendent.app.'
    });
    // Expire
    jest.useFakeTimers().setSystemTime(new Date('2022-08-02'))
    expect(checkIfLicenseIsValid(contract.licenseKey)).toStrictEqual({
      success: false,
      errorMessage: 'The license key has expired. Please buy a new license at superintendent.app.'
    });
  });
});
