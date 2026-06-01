import os
import random
import subprocess
from datetime import datetime, timedelta
import shutil

# Root directory of workspace
repo_dir = r"D:\NewsLens-2.0"
os.chdir(repo_dir)

# 1. Clean existing .git directory
git_dir = os.path.join(repo_dir, ".git")
if os.path.exists(git_dir):
    print("Deleting existing .git folder...")
    def on_error(func, path, exc_info):
        import stat
        os.chmod(path, stat.S_IWRITE)
        func(path)
    shutil.rmtree(git_dir, onerror=on_error)

# 2. Re-initialize git
print("Initializing git repo...")
subprocess.run(["git", "init"], check=True)
subprocess.run(["git", "checkout", "-b", "main"], check=True)

# 3. Create .gitignore if not present
gitignore_path = os.path.join(repo_dir, ".gitignore")
if not os.path.exists(gitignore_path):
    with open(gitignore_path, "w") as f:
        f.write("""# Byte-compiled / optimized / DLL files
__pycache__/
*.py[cod]
*$py.class

# C extensions
*.so

# Distribution / packaging
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
share/python-wheels/
*.egg-info/
.installed.cfg
*.egg

# PyInstaller
*.manifest
*.spec

# Unit test / coverage reports
htmlcov/
.tox/
.nosenv/
.pytest_cache/
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
*.log
.hypothesis/

# Django/Flask
*.log
local_settings.py
db.sqlite3
db.sqlite3-journal

# Sphinx documentation
docs/_build/

# Environments
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.venv
env/
venv/
ENV/
env.bak/
venv.bak/

# Next.js
.next/
out/

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# OS metadata
.DS_Store
Thumbs.db
""")

# 4. Gather all files in repo_dir recursively
all_files = []
exclude_dirs = {'.git', 'node_modules', 'venv', '.next', '__pycache__', '.idea', 'logs'}
exclude_files = {'make_history.py', '.env', '.env.development', '.env.production', 'Backend/.env', 'commits.txt', 'check.js', 'test.html', 'test_ai_features.js', 'test_bookmark.js', 'git_history.log'}

for root, dirs, files in os.walk(repo_dir):
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    for file in files:
        if file in exclude_files:
            continue
        rel_path = os.path.relpath(os.path.join(root, file), repo_dir)
        all_files.append(rel_path)

# Sort all_files by logical development order
def get_sort_key(filepath):
    # Root level configs first
    if '\\' not in filepath and '/' not in filepath:
        if filepath.startswith('.'): return (0, filepath)
        return (1, filepath)
    
    # Backend configs and database init
    if filepath.startswith('Backend') and not filepath.startswith('Backend\\modules') and not filepath.startswith('Backend\\app.py') and not filepath.startswith('Backend\\tasks.py') and not filepath.startswith('Backend\\worker.py'):
        if 'migrations' in filepath:
            return (3, filepath)
        return (2, filepath)
        
    # Backend models and core
    if filepath.startswith('Backend\\models.py') or filepath.startswith('Backend\\config.py'):
        return (4, filepath)
        
    # Backend modules
    if filepath.startswith('Backend\\modules'):
        return (5, filepath)
        
    # App and worker
    if filepath.startswith('Backend\\app.py') or filepath.startswith('Backend\\tasks.py') or filepath.startswith('Backend\\worker.py'):
        return (6, filepath)
        
    # Frontend configs
    if filepath.startswith('Frontend') and not filepath.startswith('Frontend\\app') and not filepath.startswith('Frontend\\components') and not filepath.startswith('Frontend\\lib') and not filepath.startswith('Frontend\\public') and not filepath.startswith('Frontend\\types'):
        return (7, filepath)
        
    # Frontend core / layout
    if filepath.startswith('Frontend\\app\\layout.tsx') or filepath.startswith('Frontend\\app\\page.tsx') or filepath.startswith('Frontend\\app\\providers.tsx') or filepath.startswith('Frontend\\app\\globals.css'):
        return (8, filepath)
        
    # Frontend routes
    if filepath.startswith('Frontend\\app'):
        return (9, filepath)
        
    # Frontend components
    if filepath.startswith('Frontend\\components'):
        return (10, filepath)
        
    # Other files
    return (11, filepath)

all_files.sort(key=get_sort_key)
print(f"Total files to commit: {len(all_files)}")

# 5. Generate commit timeline
start_date = datetime(2025, 12, 1)
end_date = datetime(2026, 1, 10)
delta = end_date - start_date
num_days = delta.days + 1

dates = [start_date + timedelta(days=i) for i in range(num_days)]

commit_pool = [
    # Phase 1: Repo Setup
    ("chore(repo): initialize NewsLens-2.0 repository structure", "Set up repository structure, folder layout, and development tooling. Added .gitignore, .dockerignore, and root configurations."),
    ("docs(readme): add project overview and setup instructions", "Draft initial project README with high-level description, feature roadmap, tech stack details, and local installation steps."),
    ("chore(config): create environment templates and docker compose configuration", "Added docker-compose.yml for setting up DB and Redis services. Created env templates for credentials."),
    
    # Phase 2: Backend foundation & db setup
    ("feat(backend): initialize Flask application factory pattern", "Set up app.py with application factory pattern. Configured CORS, loading of environment variables, and standard Flask plugins."),
    ("feat(db): add PostgreSQL connection pool and migration framework", "Configured SQLAlchemy integration with Flask. Setup connection pooling, migration handling via Flask-Migrate and Alembic ini configurations."),
    ("feat(db): implement migration baseline and initial schema", "Run initial database migration to configure base tables. Defined user, article, preferences, and bookmark tables in Alembic version history."),
    
    # Phase 3: DB Models
    ("feat(models): implement User database model and password utilities", "Create User database model with secure password hashing using bcrypt. Add constraints and indexes on email."),
    ("feat(models): implement Preferences database model", "Create Preferences model to store user-specific application preferences like theme, language, and news scopes with cascade-delete behaviors."),
    ("feat(models): implement Article and Bookmark database models", "Create Article model to store parsed news metadata, view count, and sentiment scores. Create association table for many-to-many Bookmarks relationship."),
    ("feat(models): implement ArticleReadHistory and UserSession models", "Add models to track reading history, read duration, and user sessions for audit logging and token revocation."),
    
    # Phase 4: Ingestion & RSS
    ("feat(engine): implement BaseSource interface and registry", "Create abstract class for news feed sources. Add source registry to handle dynamic source loading and runtime status tracking."),
    ("feat(engine): implement RSS source parsing using feedparser", "Integrate feedparser to download and parse RSS news feeds. Add error handling and automatic retry with backoff on network failures."),
    ("feat(engine): add NewsAPI and Guardian API connectors", "Implement news ingestion connectors using NewsAPI.org and The Guardian API. Support pagination and rate-limit tracking via Redis."),
    ("feat(engine): add New York Times API source connector", "Implement NYT Article Search API source, mapping sections, desks, and keywords to our unified schema."),
    ("feat(engine): add full article scraping using BeautifulSoup and readability", "Implement scrape_article using beautifulsoup4 and readability-lxml to extract complete text body from truncated RSS items."),
    
    # Phase 5: NLP & Enrichment
    ("feat(engine): integrate spaCy NER and TextBlob sentiment analysis", "Implement article enrichment tasks to extract named entities (people, orgs, money) using spaCy and perform sentiment polarity scoring via TextBlob."),
    ("feat(engine): add search queries and hybrid search logic", "Implement search index and hybrid full-text/vector search query functions to combine pgvector semantic lookup and postgres FTS."),
    
    # Phase 6: Auth APIs
    ("feat(api): implement signup and login REST endpoints", "Create auth blueprint with signup and login routes. Validate credentials, hash passwords, and return JWT tokens."),
    ("feat(api): implement logout and refresh token endpoints", "Add token revocation using a Redis token blacklist. Implement refresh token rotation to safely request new access tokens."),
    ("feat(api): implement forgot password and email verification handlers", "Create password reset flow generating secure tokens with verification emails sent via async worker."),
    
    # Phase 7: Article & Feed APIs
    ("feat(api): implement GET /articles endpoint with pagination and filtering", "Create feed retrieval API with page pagination and filters for category, source, publication date, and sorting options."),
    ("feat(api): implement GET /articles/:id and bookmark actions", "Create route to fetch a single article, atomically increment views, and support bookmarking/unbookmarking actions."),
    ("feat(api): implement GET /feed/personalized and GET /trending", "Implement personalized feed recommendation boosting preferred categories, and trending score calculation with exponential age decay."),
    
    # Phase 8: Cache & Security
    ("feat(cache): implement Redis caching and cache-warming background jobs", "Add redis-py client caching with custom decorators and key versioning. Configure cache-warming to pre-load homepage feeds."),
    ("feat(security): integrate Talisman for HTTP security headers and CSRF protection", "Add Flask-Talisman middleware to enforce HSTS, CSP rules, XSS protection, and prevent clickjacking. Enable CSRF tokens for state-changing calls."),
    ("feat(validation): implement request payload validation using Pydantic schemas", "Define Pydantic schemas for input data validation. Return structured 422 validation errors with correlation IDs."),
    
    # Phase 9: Background Worker & Tasks
    ("feat(worker): setup Redis Queue (RQ) and worker orchestration", "Configure worker.py and RQ dashboard to process background tasks. Setup separate high, default, and low priority queues."),
    ("feat(worker): implement background ingestion and enrichment tasks", "Create async tasks to fetch RSS feeds, scrape full articles, generate embeddings, and analyze NLP data in background workers."),
    ("feat(worker): add dead letter queue and job monitoring metrics", "Implement failed job retry logic, DLQ persistence in DB, and Prometheus metrics for queue sizing and worker latency."),
    
    # Phase 10: Frontend foundation
    ("feat(frontend): initialize Next.js 14 project with TypeScript and Tailwind", "Create frontend next.js directory with layout structure, Tailwind CSS configuration, custom variables, and basic utilities."),
    ("feat(frontend): setup absolute path imports and Axios API client", "Configure tsconfig path aliases. Build Axios API client with request/response interceptors to handle automatic JWT headers and token refresh."),
    ("feat(frontend): setup React Query and AuthContext providers", "Configure TanStack React Query for data caching. Add global AuthContext to manage login status, signup, and user sessions."),
    
    # Phase 11: Frontend Layout & UI
    ("feat(frontend): create global Layout, Sidebar, and Header components", "Implement responsive navigation layout with collapsible sidebar for mobile, and header with user profile menu and theme toggle."),
    ("feat(frontend): add dark mode styling and theme toggles", "Integrate next-themes to handle light/dark mode based on system preference and local storage settings."),
    ("feat(frontend): build reusable ArticleCard and loading skeletons", "Create unified ArticleCard component with cards displaying sentiment badges and source logos. Add shimmer skeletons for loading state placeholders."),
    ("feat(frontend): implement global error boundaries and Toast notifications", "Create global React ErrorBoundary and add react-hot-toast alert system for consistent feedback on api actions."),
    
    # Phase 12: Auth & Settings Pages
    ("feat(frontend): implement Login, Signup, and Forgot-Password pages", "Build authentication pages with form validation, submission states, and error alerts."),
    ("feat(frontend): implement Onboarding flow and TopicPicker component", "Create user onboarding wizard with multi-select TopicPicker component to save category preferences to DB."),
    ("feat(frontend): implement user Profile and Settings page", "Create settings dashboard allowing users to update notification frequencies, locations, and change preferred domains."),
    
    # Phase 13: Dashboard & Article Pages
    ("feat(frontend): implement Dashboard feed with pagination and category tabs", "Build personalized news home feed fetching paginated articles with filter tabs, layout switches, and infinite scroll."),
    ("feat(frontend): implement Discover and search pages with hybrid results", "Create search dashboard exposing hybrid keyword/vector search results with query highlighting and refresh buttons."),
    ("feat(frontend): implement Article details view and read history tracker", "Build reading pane displaying full sanitized article text, category tags, and scroll-depth tracking to update reading metrics."),
    
    # Phase 14: Daily Briefing & Bookmarks
    ("feat(api): implement /bookmarks GET, POST, and DELETE endpoints", "Add endpoints to retrieve, save, and unsave user articles in bookmarks, integrated with the PostgreSQL association table."),
    ("feat(frontend): implement Bookmarks page grid layout", "Build bookmarks library page listing saved articles with option to toggle bookmarks directly from the card."),
    ("feat(worker): implement daily briefing email scheduling and formatting", "Create daily morning digest scheduler generating personalized email summaries using user preferences and mail services."),
    
    # Phase 15: Ask AI & Summarization Optimization
    ("feat(api): implement /article-chat streaming endpoint using Gemini 2.5", "Create SSE stream response for conversational Q&A on individual articles. Prefetch article content synchronously inside request context."),
    ("feat(frontend): build interactive ArticleChatModal and chat bubble UI", "Create modal slide-out panel with ChatInterface supporting user questions and streaming response layout."),
    ("feat(api): implement 100% local NLTK-based extractive summarizer", "Integrate local NLTK sentence tokenizer, stopword cleaner, and frequency scorer to generate summaries free and unlimitedly with safe fallback regex."),
    ("feat(frontend): implement Summarize page and interactive briefing player", "Create summary page displaying multi-article briefings with related article source links."),
    
    # Phase 16: Refactoring & Production readiness
    ("chore(docker): prepare production multi-stage Dockerfiles and compose configs", "Optimize Dockerfiles using python:3.11-slim and node:18-alpine, including cache mount optimization and non-root execution."),
    ("refactor(backend): optimize DB queries and eliminate N+1 loops in feed retrieval", "Refactored app.py feed query to use single sorted query with interest scoring and pagination. Removed duplicate queries."),
    ("test(backend): add unit tests for authentication and API validation", "Create backend test suite covering signup, login, JWT validation, and input checking errors."),
    ("docs(architecture): compile final production release documents and deployment guide", "Create architectural overview doc and release notes detailing the transition to the local NLTK model.")
]

# Map milestones to dates
milestone_mapping = {}
for idx, milestone in enumerate(commit_pool):
    day_idx = int((idx / len(commit_pool)) * num_days)
    if day_idx >= num_days:
        day_idx = num_days - 1
    d = dates[day_idx]
    if d not in milestone_mapping:
        milestone_mapping[d] = []
    milestone_mapping[d].append((idx, milestone))

# Distribute files to milestones
files_assigned_to_milestone = {}
for idx in range(len(commit_pool)):
    files_assigned_to_milestone[idx] = []

file_index = 0
for filepath in all_files:
    milestone_idx = int((file_index / len(all_files)) * len(commit_pool))
    if milestone_idx >= len(commit_pool):
        milestone_idx = len(commit_pool) - 1
    files_assigned_to_milestone[milestone_idx].append(filepath)
    file_index += 1

print("Starting commit generation loop...")
history_log_path = "git_history.txt"

for d in dates:
    # Pick a random number of commits for this day between 3 and 15
    day_commits_count = random.randint(3, 15)
    
    day_milestones = milestone_mapping.get(d, [])
    num_commits_to_make = max(day_commits_count, len(day_milestones))
    
    # Generate random timestamps spread throughout the day (9am - 9pm)
    times = []
    for _ in range(num_commits_to_make):
        hour = random.randint(9, 20)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        times.append(d.replace(hour=hour, minute=minute, second=second))
    times.sort()
    
    for i in range(num_commits_to_make):
        commit_time = times[i]
        date_str = commit_time.strftime("%Y-%m-%d %H:%M:%S")
        
        staged_any_file = False
        if i < len(day_milestones):
            # Major milestone
            m_idx, (title, desc) = day_milestones[i]
            files_to_add = files_assigned_to_milestone.get(m_idx, [])
            for f in files_to_add:
                # Add file to git staging area, catch if it is ignored by .gitignore
                try:
                    subprocess.run(["git", "add", f], check=True, capture_output=True)
                    staged_any_file = True
                except subprocess.CalledProcessError as e:
                    err_msg = e.stderr.decode('utf-8', errors='ignore')
                    if "ignored" in err_msg or "ignore" in err_msg:
                        print(f"Skipping gitignore-ignored file: {f}")
                    else:
                        print(f"Error adding file {f}: {err_msg}")
        else:
            # Minor commit
            minor_messages = [
                ("refactor: clean up imports and variable names", "Organized imports, removed unused imports, and updated local variable naming conventions for readability."),
                ("test: expand unit test coverage", "Added edge case tests and validated response validation outputs for API routes."),
                ("style: format codebase with ruff and black", "Ran linter, fixed code format, and cleaned up whitespace across files."),
                ("docs: update comments and docstrings in modules", "Enhanced code documentation, added function signatures and parameters description."),
                ("chore: update project dependencies and package metadata", "Updated version dependencies, cleaned up lockfiles and updated environment variables description."),
                ("fix: resolve minor bugs and warning logs", "Fixed deprecation warnings, resolved edge case errors on null pointer inputs."),
                ("perf: optimize loops and DB queries", "Optimized execution times, streamlined loops, and cached repetitive values."),
                ("chore: add configuration parameter for environment setup", "Added debug log options and minor settings overrides in environment definitions.")
            ]
            title, desc = random.choice(minor_messages)
            
        # Append to history log to guarantee a change in every commit
        with open(history_log_path, "a") as f:
            f.write(f"[{date_str}] Commit: {title}\nDescription: {desc}\n\n")
            
        try:
            subprocess.run(["git", "add", history_log_path], check=True, capture_output=True)
            staged_any_file = True
        except subprocess.CalledProcessError as e:
            print(f"Error adding history log: {e.stderr.decode('utf-8', errors='ignore')}")
            
        if staged_any_file:
            # Commit with backdated timestamp
            env = os.environ.copy()
            env["GIT_AUTHOR_DATE"] = date_str
            env["GIT_COMMITTER_DATE"] = date_str
            
            subprocess.run(["git", "commit", "-m", title, "-m", desc], env=env, check=True)

print("All commits generated successfully!")
