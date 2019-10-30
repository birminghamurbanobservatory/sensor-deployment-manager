

export function nameToClientId(name: string): string {

  const lowercased = name.toLowerCase();
  const noSpaces = lowercased.replace(/\s+/g, '-');
  const urlSafe = noSpaces.replace(/[^a-z0-9-]/g, '');

  const clientId = urlSafe;
  return clientId;

}