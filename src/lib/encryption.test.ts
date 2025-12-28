import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './encryption';

describe('encryption', () => {
    it('round-trips a plaintext string', () => {
        const plaintext = 'ya29.a0-example-refresh-token';
        const encrypted = encrypt(plaintext);
        expect(decrypt(encrypted)).toBe(plaintext);
    });

    it('produces different ciphertext for the same input on each call', () => {
        const plaintext = 'same-input';
        expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
    });

    it('encodes as iv:ciphertext hex', () => {
        const encrypted = encrypt('hello');
        const parts = encrypted.split(':');
        expect(parts).toHaveLength(2);
        expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);
    });
});
