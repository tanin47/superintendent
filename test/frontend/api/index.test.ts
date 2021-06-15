import {extractPublicKey, verifySignature} from '../../../src/frontend/api';
import fs from 'fs';

describe('api', () => {
  it('extractPublicKey', () => {
    const publicKey = [
      'MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAqCU0F3A1hyJOxuWy3/+u',
      'w7ZXPdCe3iCZ8JQRWFoX9j23MZyJLHSHWqUdAEM/JU5bJjzKX/583lbrwOdJSRzK',
      'eJthZ8fhomibrpBPF2486WsDiRy7gHF/oT4kZJioH85TzjvigtBojIJ86PT0Ivqf',
      'ZPatnRhBrT7OGo2+bspjJNj5pPMNz+z7ZURvX8KuJKvzHRsg9zu4/ks7J4WbFwp1',
      'CTnMUZLaeXoRnBNm/cQ3LcWOmAUUe3rrwRDGfCPQeu5/TT38uNJ/3RdlzxN+WD2F',
      '0t8Cgfizhrd52/MwUzV5ytwWWF6X7hSIMhALZ0Scuna/qUP72CdfsM7n4Opx7osr',
      'FVmD5m8z5TiO7r5zLxCAgi5veoniYEqfB8nHh5WdBJSteR2ELLqUVg1C07SRRLpu',
      'lA0+IO2SWROvknqpxCNVcqfmxplt14a5d5lNH4dMd+f+9HUyC0ftsfIWfjNp2Bzl',
      '7tLQKwHWGkcftyssxTk0m504bwfPIjpgK5vT3P88RTK80iSW8uy6hLyy71V7NYAZ',
      'c7x3pZnE1VrI3hEFkIIOAfksmaQtDO14B4oIihQA6DNC/Gth4dkSgXkTJYwT6xMo',
      'PmB2pIKXd1PRtqo+aMi1r/ilh4HMy6Lsv3tTx8Tj98UZlXxCHdDL8sS+p5kfh3aK'
    ].join('\n');
    const key = extractPublicKey(
      `---- Superintendent license ----
Type: Beta
Name: Tanin
Email: someemail@example.com
Key0: BZzBwpg2R2tXNzAHhzecqs5L6WODozDcyDYlmkCfkLNjPEu==
Key1:
${publicKey}
---- End of Superintendent license ----`
    )

    expect(key).toEqual(publicKey);
  });

  it('validates the license key correctly', () => {
    const contract = JSON.parse(fs.readFileSync('./test/frontend/api/contract/license.json').toString());

    expect(verifySignature(contract.licenseKey, contract.message, contract.signature)).toBe(true);
    expect(verifySignature(contract.licenseKey, contract.message + '1', contract.signature)).toBe(false);
  });
});
