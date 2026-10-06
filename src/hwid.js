// Which PC this is, for the hosted translator's trial and account binding:
// sha256 of "dota-translator|hwid|" + Windows' MachineGuid. The guid itself
// never leaves the PC; it is read with reg.exe (no PowerShell, nothing opened
// but the registry value). Reinstalling the app does not change it; reinstalling
// Windows does.

import crypto from 'node:crypto';
import { execFile } from 'node:child_process';

export const hwidFrom = (guid) => crypto.createHash('sha256').update('dota-translator|hwid|' + String(guid).trim().toLowerCase()).digest('hex');

// `reg query` prints "    MachineGuid    REG_SZ    xxxxxxxx-xxxx-...".
export function guidFromReg(out) {
  const m = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]{36})/.exec(String(out || ''));
  return m ? m[1].toLowerCase() : '';
}

// Resolves to the hash, or '' when the registry could not be read (not
// Windows, a locked-down PC): then the account cannot be used from here.
export function readHwid({ run = execFile } = {}) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' && run === execFile) return resolve('');
    run('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'], { windowsHide: true, timeout: 5000 }, (err, stdout) => {
      const guid = err ? '' : guidFromReg(stdout);
      resolve(guid ? hwidFrom(guid) : '');
    });
  });
}
