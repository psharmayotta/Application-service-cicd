// consumer_rdkafka_seek0.js
const Kafka = require('node-rdkafka');

const BOOTSTRAP = 'k8s-kafka-kafkacon-59cf5cd8f7-6f0e7a4f2e396abf.elb.ap-south-1.amazonaws.com:9095';
const USER = 'user1';
const PASS = '9igwoJRnTK';
const TOPIC = process.env.TOPIC || 'onprem-node-snapshot';
const GROUP_ID = process.env.GROUP_ID || 'node-rdk-consumer';

const consumer = new Kafka.KafkaConsumer({
  'bootstrap.servers': BOOTSTRAP,
  'security.protocol': 'sasl_plaintext',
  'sasl.mechanisms': 'SCRAM-SHA-256',
  'sasl.username': USER,
  'sasl.password': PASS,
  'group.id': GROUP_ID,
  'enable.auto.commit': false,        // we’ll manually control offsets
  'auto.offset.reset': 'earliest',    // if no commit exists, start at earliest
  'metadata.request.timeout.ms': 30000,
  'socket.keepalive.enable': true,
}, {});

consumer
  .on('ready', () => {
    console.log(`Connected. Subscribing to "${TOPIC}" ...`);
    // Get partition list and force assign to offset 0 (reads from beginning even if group has commits)
    consumer.getMetadata({ topic: TOPIC, timeout: 10000 }, (err, md) => {
      if (err) { console.error('metadata error:', err); process.exit(1); }
      const t = md.topics.find(t => t.name === TOPIC);
      if (!t || !t.partitions) { console.error('topic not found or no partitions'); process.exit(1); }
      const assignments = t.partitions.map(p => ({ topic: TOPIC, partition: p.id, offset: 0 }));
      consumer.assign(assignments);
      console.log('Assigned from beginning:', assignments);
      consumer.consume();
    });
  })
  .on('data', (msg) => {
    const val = msg.value ? msg.value.toString() : '';
    console.log(`${msg.topic}[${msg.partition}] @ ${msg.offset} -> ${val}`);
    // commit as you wish:
    consumer.commitMessage(msg);
  })
  .on('event.error', (err) => {
    console.error('event.error:', err);
  })
  .on('disconnected', (arg) => {
    console.warn('disconnected', arg);
  });

consumer.connect();

process.on('SIGINT', () => { consumer.disconnect(); });
process.on('SIGTERM', () => { consumer.disconnect(); });
