import { isPrivateIp, validateUrlForSsrf } from '../src/utils/security/ssrfValidator';
import dns from 'dns';

jest.mock('dns');

describe('SSRF Validator Unit Tests', () => {
    describe('isPrivateIp', () => {
        test('should identify loopback and internal RFC1918 IPs as private', async () => {
            expect(await isPrivateIp('127.0.0.1')).toBe(true);
            expect(await isPrivateIp('localhost')).toBe(true);
            expect(await isPrivateIp('10.0.1.5')).toBe(true);
            expect(await isPrivateIp('172.16.0.1')).toBe(true);
            expect(await isPrivateIp('192.168.1.1')).toBe(true);
            expect(await isPrivateIp('169.254.169.254')).toBe(true);
        });

        test('should identify public IPs as non-private', async () => {
            expect(await isPrivateIp('8.8.8.8')).toBe(false);
            expect(await isPrivateIp('1.1.1.1')).toBe(false);
        });
    });

    describe('validateUrlForSsrf', () => {
        test('should allow public HTTP/HTTPS URLs', async () => {
            (dns.lookup as any).mockImplementation((host: string, cb: any) => cb(null, { address: '8.8.8.8' }));

            await expect(validateUrlForSsrf('https://example.com/api')).resolves.not.toThrow();
        });

        test('should reject invalid protocol', async () => {
            await expect(validateUrlForSsrf('ftp://example.com/file')).rejects.toThrow('Only HTTP and HTTPS protocols are supported');
        });

        test('should reject private or loopback hosts', async () => {
            await expect(validateUrlForSsrf('http://127.0.0.1/admin')).rejects.toThrow('Access to private or local networks is forbidden');
            await expect(validateUrlForSsrf('http://169.254.169.254/latest/meta-data')).rejects.toThrow('Access to private or local networks is forbidden');
        });

        test('should reject hostname resolving to private IP', async () => {
            (dns.lookup as any).mockImplementation((host: string, cb: any) => cb(null, { address: '10.0.0.1' }));

            await expect(validateUrlForSsrf('https://internal-dev.company.local')).rejects.toThrow('URL resolves to a forbidden private or local network address');
        });
    });
});
