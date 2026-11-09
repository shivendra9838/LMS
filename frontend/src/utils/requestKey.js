export function persistentRequestKey(scope) {
  let key = sessionStorage.getItem(scope);
  if (!key) { key = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(''); sessionStorage.setItem(scope, key); }
  return key;
}
