# cache.py
import os
import redis
import logging
from dotenv import load_dotenv

load_dotenv() # Load .env variables

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL")

if not REDIS_URL:
    raise ValueError("REDIS_URL must be set in your .env file")

# Connect using the from_url() method
try:
    r = redis.Redis.from_url(REDIS_URL)
    r.ping() # Test the connection
    logger.info("Connected to Redis successfully.")
except Exception as e:
    logger.warning(f"Warning: Failed to connect to Redis at {REDIS_URL}: {e}. Caching functionality will be limited.")
    # Export a fallback mock/unreachable client
    r = redis.Redis.from_url(REDIS_URL)