import redis
from rq import SimpleWorker, Queue
import os
from dotenv import load_dotenv

load_dotenv()

listen = ['default']
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
conn = redis.from_url(redis_url)

if __name__ == '__main__':
    print("Starting RQ worker connecting to:", redis_url)
    queues = [Queue(name, connection=conn) for name in listen]
    worker = SimpleWorker(queues, connection=conn)
    worker.work()
