import time
import json
import logging
from flask import Response
from cache import r

logger = logging.getLogger(__name__)

def update_task_progress(task_id, status, progress, message="", details=None):
    """
    Helper function to update a background task's progress state in Redis.
    """
    try:
        data = {
            "status": status,
            "progress": progress,
            "message": message,
            "details": details or {}
        }
        r.setex(f"task_status:{task_id}", 3600, json.dumps(data))
        logger.info(f"Task {task_id} progress updated: {status} ({progress}%) - {message}")
    except Exception as e:
        logger.error(f"Failed to update task progress in Redis: {e}")

def event_stream(task_id):
    """
    Generator that polls Redis for status updates of a specific background task,
    and yields SSE events to the client.
    """
    logger.info(f"SSE stream started for task: {task_id}")
    
    # Send initial connection event
    yield f"data: {json.dumps({'status': 'connected', 'progress': 0, 'message': 'Establishing link...'})}\n\n"
    
    attempts_without_status = 0
    max_empty_attempts = 30  # Timeout if task status never appears in 30 seconds
    
    while True:
        try:
            status_data = r.get(f"task_status:{task_id}")
            if status_data:
                data = json.loads(status_data.decode('utf-8'))
                yield f"data: {json.dumps(data)}\n\n"
                
                # Terminate stream on completion states
                if data.get('status') in ['finished', 'failed', 'completed']:
                    break
                attempts_without_status = 0
            else:
                attempts_without_status += 1
                if attempts_without_status >= max_empty_attempts:
                    yield f"data: {json.dumps({'status': 'failed', 'progress': 0, 'message': 'Task tracking timed out'})}\n\n"
                    break
                yield f"data: {json.dumps({'status': 'queued', 'progress': 0, 'message': 'Waiting for worker...'})}\n\n"
        except Exception as e:
            logger.error(f"Error in SSE stream for task {task_id}: {e}")
            yield f"data: {json.dumps({'status': 'failed', 'error': str(e), 'message': 'Streaming error encountered'})}\n\n"
            break
            
        time.sleep(1)
        
    logger.info(f"SSE stream ended for task: {task_id}")
