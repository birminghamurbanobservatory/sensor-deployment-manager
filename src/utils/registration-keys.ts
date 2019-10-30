import passwordGenerator from 'password-generator';
// Can't seem to load this with an import statement.

export function generateRegistrationKey(): string {
  return passwordGenerator();
}