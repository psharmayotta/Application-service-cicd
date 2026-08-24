import sanitizeBody from '../src/middlewares/sanitizeBody.middleware';

describe('Sanitize Body Middleware Unit Tests', () => {
    test('should delete properties from body that do not exist on class model', () => {
        class UserDTO {
            username: string = '';
            email: string = '';
        }

        const modelInstance = new UserDTO();
        const requestBody = {
            username: 'john_doe',
            email: 'john@example.com',
            isAdmin: true, // Should be sanitized out
            maliciousPayload: '<script>alert(1)</script>' // Should be sanitized out
        };

        const sanitized = sanitizeBody(modelInstance, requestBody);

        expect(sanitized).toEqual({
            username: 'john_doe',
            email: 'john@example.com'
        });
        expect(sanitized.isAdmin).toBeUndefined();
        expect(sanitized.maliciousPayload).toBeUndefined();
    });
});
