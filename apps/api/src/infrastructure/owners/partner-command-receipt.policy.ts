type Row = Record<string, unknown>;
function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid command receipt');
  return value as Row;
}
const scopes = (value: unknown): string => {
  if (!Array.isArray(value) || !value.length || !value.every((v) => typeof v === 'string')) throw new Error('Invalid receipt scopes');
  return JSON.stringify([...new Set(value as string[])].sort());
};

/** Runs after strict DTO projection, before any successful command response reaches the browser. */
export function assertPartnerCommandReceipt(result: Row, input: unknown): void {
  const command = row(input);
  if (result.action !== command.action || result.partnerCode !== command.partnerCode || result.tenantId !== command.tenantId) {
    throw new Error('Command receipt does not match the submitted operation');
  }
  const action = command.action;
  if (action === 'issue_credential' || action === 'rotate_credential') {
    const credential = row(result.credential);
    if (credential.status !== 'ACTIVE' || scopes(credential.scopes) !== scopes(command.scopes) ||
      typeof result.replayed !== 'boolean' || result.secretAvailable !== !result.replayed) {
      throw new Error('Credential issuance outcome cannot be confirmed');
    }
    if (!result.replayed && typeof result.apiKey !== 'string') throw new Error('First issuance must deliver its one-time secret');
    if (result.replayed && result.apiKey !== undefined) throw new Error('A receipt replay cannot reveal a secret');
    if (action === 'rotate_credential' && (result.replacedCredentialKey !== command.credentialKey || credential.credentialKey === command.credentialKey)) {
      throw new Error('Rotation receipt does not replace the requested credential');
    }
    return;
  }
  if (result.secretAvailable !== false || result.apiKey !== undefined) throw new Error('Unexpected secret for this command');
  if (action === 'revoke_credential') {
    const credential = row(result.credential);
    if (credential.credentialKey !== command.credentialKey || credential.status !== 'REVOKED') throw new Error('Revocation outcome cannot be confirmed');
    return;
  }
  if (action === 'create_partner' || action === 'create_environment') {
    const environment = row(result.environment);
    if (environment.environment !== command.environment || environment.status !== 'ACTIVE') throw new Error('Environment creation outcome cannot be confirmed');
    if (action === 'create_partner' && row(result.partner).partnerCode !== command.partnerCode) throw new Error('Partner creation outcome cannot be confirmed');
    return;
  }
  throw new Error('Unsupported command receipt');
}
