from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import ARRAY, JSON, TSVECTOR
from pgvector.sqlalchemy import Vector

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password = db.Column(db.String(255), nullable=False)
    location = db.Column(db.String(100), nullable=True)
    country = db.Column(db.String(5), nullable=False, server_default='us')
    language = db.Column(db.String(10), nullable=False, server_default='en')
    news_scope = db.Column(db.String(50), nullable=False, server_default='GLOBAL')
    preferred_domains = db.Column(ARRAY(db.String))
    
    saved_articles = db.relationship('SavedArticle', back_populates='user', cascade='all, delete-orphan')

    def __init__(self, name, email, password, location=None, country='us', language='en', news_scope='GLOBAL', preferred_domains=None):
        self.name = name
        self.email = email
        self.password = password
        self.location = location
        self.country = country
        self.language = language
        self.news_scope = news_scope
        self.preferred_domains = preferred_domains if preferred_domains is not None else []

    def as_dict(self):
       return {
           "name": self.name,
           "email": self.email,
           "country": self.country,
           "language": self.language,
           "news_scope": self.news_scope,
           "preferred_domains": self.preferred_domains or []
       }

class SavedArticle(db.Model):
    __tablename__ = 'saved_articles'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    article_id = db.Column(db.Integer, db.ForeignKey('articles.id', ondelete='CASCADE'), nullable=False, index=True)
    saved_at = db.Column(db.DateTime, server_default=db.func.now(), nullable=False)
    
    user = db.relationship('User', back_populates='saved_articles')
    article = db.relationship('Article', back_populates='saved_by_users')
    
    # Ensure a user can only save an article once
    __table_args__ = (db.UniqueConstraint('user_id', 'article_id', name='uq_user_article'),)

class Article(db.Model):
    __tablename__ = 'articles'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    url = db.Column(db.String(500), unique=True, nullable=False)
    url_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    content_hash = db.Column(db.String(64), nullable=False, index=True)
    published_at = db.Column(db.DateTime, nullable=False)
    source_name = db.Column(db.String(150), nullable=False)
    category = db.Column(db.String(100), nullable=True)
    
    url_to_image = db.Column(db.String(500), nullable=True)
    sentiment_polarity = db.Column(db.Float, nullable=True)
    sentiment_subjectivity = db.Column(db.Float, nullable=True)
    entities = db.Column(JSON, nullable=True)
    
    embedding = db.Column(Vector(768), nullable=True)
    fts_document = db.Column(TSVECTOR, nullable=True)
    
    saved_by_users = db.relationship('SavedArticle', back_populates='article', cascade='all, delete-orphan')

    def as_dict(self):
        description = self.content[:150] + "..." if self.content and len(self.content) > 150 else (self.content or "")
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "description": description,
            "url": self.url,
            "publishedAt": self.published_at.isoformat() + "Z" if self.published_at else None,
            "urlToImage": self.url_to_image or "https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=600",
            "source": {
                "id": None,
                "name": self.source_name or "Unknown Source"
            },
            "sentiment": {
                "raw_polarity": self.sentiment_polarity or 0.0,
                "raw_subjectivity": self.sentiment_subjectivity or 0.0
            } if self.sentiment_polarity is not None else None,
            "category": self.category,
            "entities": self.entities or {}
        }

# Index for full-text search performance
db.Index('fts_idx', Article.fts_document, postgresql_using='gin')