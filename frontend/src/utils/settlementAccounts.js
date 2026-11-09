export function companyDestinations(accounts, kind) {
  return accounts.filter(account => account.active && account.owner === 'COMPANY' &&
    (kind === 'CASH' ? account.modes.includes('CASH') : kind === 'DIGITAL' && account.modes.some(mode => ['UPI', 'BANK_TRANSFER'].includes(mode))));
}

export function employeeSources(accounts, balances = []) {
  return accounts.filter(account => account.owner === 'EMPLOYEE' && account.modes.some(mode => ['UPI', 'BANK_TRANSFER'].includes(mode)) &&
    (account.active || balances.some(balance => balance.accountId === account._id && balance.availableMinor > 0)));
}
