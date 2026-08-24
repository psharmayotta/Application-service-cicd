import { EncryptionAndDecryption } from '../src/core/Encryption&Decryption';
import { StatusCode } from '../src/config';

describe('EncryptionAndDecryption Unit Tests', () => {
    describe('encryption / decryption', () => {
        test('should encrypt and decrypt an object correctly', () => {
            const data = { name: 'test', id: 42 };
            const encrypted = EncryptionAndDecryption.encryption(data);

            expect(typeof encrypted).toBe('string');
            expect(encrypted).not.toContain('test');

            const decrypted = EncryptionAndDecryption.decryption(encrypted);
            expect(decrypted).toEqual(data);
        });

        test('should encrypt and decrypt a string', () => {
            const data = 'hello world';
            const encrypted = EncryptionAndDecryption.encryption(data);
            const decrypted = EncryptionAndDecryption.decryption(encrypted);
            expect(decrypted).toBe(data);
        });

        test('should return INVALID_ENCRYPTED_INPUT for malformed input', () => {
            const result = EncryptionAndDecryption.decryption('not_valid_encrypted_text');
            expect(result).toBe(StatusCode.INVALID_ENCRYPTED_INPUT);
        });
    });

    describe('encryptionIds / decryptionIds', () => {
        test('should encrypt IDs in URL-safe format (no + or /)', () => {
            const data = { id: 12345 };
            const encrypted = EncryptionAndDecryption.encryptionIds(data);

            expect(encrypted).not.toContain('+');
            expect(encrypted).not.toContain('/');
        });

        test('should decrypt URL-safe encrypted IDs back to original', () => {
            const data = { id: 99, name: 'test' };
            const encrypted = EncryptionAndDecryption.encryptionIds(data);
            const decrypted = EncryptionAndDecryption.decryptionIds(encrypted);

            expect(decrypted).toEqual(data);
        });

        test('should return INVALID_ENCRYPTED_INPUT for malformed ID input', () => {
            const result = EncryptionAndDecryption.decryptionIds('garbage_input');
            expect(result).toBe(StatusCode.INVALID_ENCRYPTED_INPUT);
        });
    });

    describe('saltEncryption / saltCompare', () => {
        test('should hash a value and verify it matches', async () => {
            const plain = 'mysecretpassword';
            const hash = await EncryptionAndDecryption.saltEncryption(plain);

            expect(typeof hash).toBe('string');
            expect(hash).not.toBe(plain);

            const isMatch = await EncryptionAndDecryption.saltCompare(plain, hash);
            expect(isMatch).toBe(true);
        });

        test('should return false for mismatched values', async () => {
            const hash = await EncryptionAndDecryption.saltEncryption('correctpassword');
            const isMatch = await EncryptionAndDecryption.saltCompare('wrongpassword', hash);
            expect(isMatch).toBe(false);
        });
    });

    describe('encryptField / decryptField', () => {
        test('should encrypt and decrypt a field value', () => {
            const value = 'sensitive-data-123';
            const encrypted = EncryptionAndDecryption.encryptField(value);

            expect(typeof encrypted).toBe('string');
            expect(encrypted).not.toBe(value);

            const decrypted = EncryptionAndDecryption.decryptField(encrypted);
            expect(decrypted).toBe(value);
        });

        test('should return empty string for undefined input', () => {
            expect(EncryptionAndDecryption.encryptField(undefined)).toBe('');
            expect(EncryptionAndDecryption.decryptField(undefined)).toBe('');
        });

        test('should return empty string for empty string input', () => {
            expect(EncryptionAndDecryption.encryptField('')).toBe('');
            expect(EncryptionAndDecryption.decryptField('')).toBe('');
        });
    });
});
