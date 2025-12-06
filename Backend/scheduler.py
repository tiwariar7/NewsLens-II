import time
import schedule
import os
from dotenv import load_dotenv
import logging
from rq import Queue
from redis import Redis
from app import app
from models import db, User
from tasks import generate_and_send_briefing

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
redis_conn = Redis.from_url(redis_url)
q = Queue('default', connection=redis_conn)

def queue_daily_briefings():
    logger.info("Queuing daily briefings for all users...")
    with app.app_context():
        users = User.query.all()
        for user in users:
            q.enqueue(generate_and_send_briefing, user.email)
            logger.info(f"Queued daily briefing for {user.email}")

if __name__ == "__main__":
    logger.info("Starting Daily Briefing Scheduler...")
    # Schedule to run every day at 08:00 AM local server time
    schedule.every().day.at("08:00").do(queue_daily_briefings)
    
    while True:
        schedule.run_pending()
        time.sleep(60)
