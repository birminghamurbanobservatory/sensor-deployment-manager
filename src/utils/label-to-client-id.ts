

export function labelToClientId(label: string): string {

  const lowercased = label.toLowerCase();
  const noSpaces = lowercased.replace(/\s+/g, '-');
  const urlSafe = noSpaces.replace(/[^a-z0-9-]/g, '');

  const clientId = urlSafe;
  return clientId;

}