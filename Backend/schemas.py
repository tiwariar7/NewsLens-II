from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List

class SignupSchema(BaseModel):
    name: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=6)
    location: Optional[str] = ""
    country: Optional[str] = "us"
    language: Optional[str] = "en"

class LoginSchema(BaseModel):
    email: EmailStr
    password: str

class UpdatePreferencesSchema(BaseModel):
    preferred_domains: List[str]
    country: str
    language: str
    news_scope: str
