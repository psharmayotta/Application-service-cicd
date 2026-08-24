import WebhookService from '../src/services/webhook/webhookService.services';
import axios from 'axios';
import Database from '../src/database/database';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebhookService Unit Tests', () => {
    let service: WebhookService;

    beforeEach(() => {
        service = new WebhookService();
        jest.clearAllMocks();
    });

    describe('sendSlackAlert', () => {
        test('should post formatted message to slack webhook url', async () => {
            mockedAxios.post.mockResolvedValueOnce({ data: 'ok' });
            await service.sendSlackAlert('https://hooks.slack.com/services/123', 'Alert Title', 'Alert body text', []);
            expect(mockedAxios.post).toHaveBeenCalledWith(
                'https://hooks.slack.com/services/123',
                { text: '*Alert Title*\nAlert body text' },
                { timeout: 5000 }
            );
        });

        test('should include facts in slack message', async () => {
            mockedAxios.post.mockResolvedValueOnce({ data: 'ok' });
            await service.sendSlackAlert('https://hooks.slack.com/services/123', 'Title', 'Body', [{ name: 'Status', value: 'Failed' }]);
            expect(mockedAxios.post).toHaveBeenCalledWith(
                'https://hooks.slack.com/services/123',
                { text: expect.stringContaining('• *Status:* Failed') },
                { timeout: 5000 }
            );
        });

        test('should catch error silently if axios fails', async () => {
            mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));
            await expect(service.sendSlackAlert('https://invalid', 'Title', 'Body')).resolves.not.toThrow();
        });
    });

    describe('sendTeamsAlert', () => {
        test('should post formatted card to Teams webhook', async () => {
            mockedAxios.post.mockResolvedValueOnce({ data: 'ok' });
            await service.sendTeamsAlert('https://outlook.office.com/webhook/123', 'Alert Title', 'Alert Text', [{ name: 'Host', value: 'node-1' }]);
            expect(mockedAxios.post).toHaveBeenCalledWith(
                'https://outlook.office.com/webhook/123',
                expect.objectContaining({
                    '@type': 'MessageCard',
                    title: 'Alert Title',
                    text: 'Alert Text',
                }),
                { timeout: 5000 }
            );
        });
    });

    describe('sendPagerDutyAlert', () => {
        test('should post event payload to PagerDuty API', async () => {
            mockedAxios.post.mockResolvedValueOnce({ data: 'ok' });
            await service.sendPagerDutyAlert('routing-key-123', 'CPU limit exceeded', 'Details here');
            expect(mockedAxios.post).toHaveBeenCalledWith(
                'https://events.pagerduty.com/v2/enqueue',
                expect.objectContaining({
                    routing_key: 'routing-key-123',
                    payload: expect.objectContaining({ summary: 'CPU limit exceeded' })
                }),
                { timeout: 5000 }
            );
        });
    });

    describe('sendVictorOpsAlert', () => {
        test('should append routing key and post payload to VictorOps', async () => {
            mockedAxios.post.mockResolvedValueOnce({ data: 'ok' });
            await service.sendVictorOpsAlert('https://alert.victorops.com/post', 'key1', 'Memory warning', 'Details');
            expect(mockedAxios.post).toHaveBeenCalledWith(
                'https://alert.victorops.com/post/key1',
                expect.objectContaining({
                    entity_display_name: 'Memory warning',
                    state_message: 'Details'
                }),
                { timeout: 5000 }
            );
        });
    });

    describe('sendMailAlert', () => {
        test('should send kafka message for each email address', async () => {
            const kafkaSendSpy = jest.fn().mockResolvedValue(undefined);
            jest.spyOn(require('../src/utils/kafka/KafkaService').KafkaService, 'getInstance').mockReturnValue({
                sendMessage: kafkaSendSpy
            });

            await service.sendMailAlert(['test1@example.com', 'test2@example.com'], 'Test Subject', 'Body text', [], 'Go to Dashboard', '/dashboard');
            expect(kafkaSendSpy).toHaveBeenCalledTimes(2);
            expect(kafkaSendSpy).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    request: expect.objectContaining({
                        to: 'test1@example.com',
                        emailcode: 'WEBHOOK_ALERT',
                        variables: expect.objectContaining({
                            subject: 'Test Subject',
                            message: 'Body text',
                            cta_text: 'Go to Dashboard'
                        })
                    })
                })
            );
        });
    });

    describe('dispatchAlert', () => {
        test('should query active configs and send alerts for matching eventType', async () => {
            const executeQuerySpy = jest.fn().mockResolvedValue([
                {
                    id: 1,
                    platform: 'SLACK',
                    config: { webhook_url: 'https://hooks.slack.com/123' },
                    events: ['BUDGET_EXCEEDED'],
                    is_active: true
                },
                {
                    id: 2,
                    platform: 'MAIL',
                    config: { emails: ['admin@example.com'] },
                    events: ['BUDGET_EXCEEDED'],
                    is_active: true
                }
            ]);

            jest.spyOn(Database, 'getInstance').mockReturnValue({
                executeExternalQuery: executeQuerySpy,
            } as any);

            const slackSpy = jest.spyOn(service, 'sendSlackAlert').mockResolvedValue();
            const mailSpy = jest.spyOn(service, 'sendMailAlert').mockResolvedValue();

            await service.dispatchAlert(10, 'BUDGET_EXCEEDED', {
                title: 'Budget Alert',
                text: 'Monthly limit reached',
                facts: []
            });

            expect(executeQuerySpy).toHaveBeenCalledWith(expect.any(String), [10]);
            expect(slackSpy).toHaveBeenCalledWith('https://hooks.slack.com/123', 'Budget Alert', 'Monthly limit reached', []);
            expect(mailSpy).toHaveBeenCalledWith(['admin@example.com'], 'Budget Alert', 'Monthly limit reached', [], '', '');
        });
    });

    describe('dispatchTemplatedAlert', () => {
        test('should dispatch using template for known module/action', async () => {
            const executeQuerySpy = jest.fn().mockResolvedValue([
                {
                    id: 1,
                    platform: 'TEAMS',
                    config: { webhook_url: 'https://teams.webhook/123' },
                    events: ['Deployment'],
                    is_active: true
                }
            ]);

            jest.spyOn(Database, 'getInstance').mockReturnValue({
                executeExternalQuery: executeQuerySpy,
            } as any);

            const teamsSpy = jest.spyOn(service, 'sendTeamsAlert').mockResolvedValue();

            await service.dispatchTemplatedAlert(10, 'Deployment', 'READY', {
                name: 'Llama-3',
                workspace: 'FANG-V'
            });

            expect(teamsSpy).toHaveBeenCalledWith(
                'https://teams.webhook/123',
                'Llama-3 successfully deployed.',
                'Llama-3 deployed in FANG-V.',
                [{ name: 'Status', value: '✅ Completed' }],
                'Completed'
            );
        });

        test('should skip dispatch if no template found', async () => {
            const executeQuerySpy = jest.fn().mockResolvedValue([]);
            jest.spyOn(Database, 'getInstance').mockReturnValue({
                executeExternalQuery: executeQuerySpy,
            } as any);

            await service.dispatchTemplatedAlert(10, 'UnknownModule', 'UNKNOWN_ACTION', {});
            expect(executeQuerySpy).not.toHaveBeenCalled();
        });
    });
});
