from pydantic import BaseModel, Field, model_validator


class LoginRequest(BaseModel):
    identifier: str | None = Field(default=None, min_length=1)
    username: str | None = Field(default=None, min_length=1)
    password: str = Field(min_length=1)

    @model_validator(mode="after")
    def normalize_identifier(self):
        if not self.identifier and self.username:
            self.identifier = self.username

        if not self.identifier:
            raise ValueError("identifier is required")

        self.identifier = self.identifier.strip()
        return self


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2)
    username: str = Field(min_length=3)
    email: str = Field(min_length=3)
    phone: str = Field(min_length=5)
    governorate: str = Field(min_length=2)
    city: str = Field(min_length=2)
    address_line: str = Field(min_length=5)
    address_notes: str | None = None
    password: str = Field(min_length=6)
    confirm_password: str = Field(min_length=6)

    @model_validator(mode="after")
    def validate_payload(self):
        self.full_name = self.full_name.strip()
        self.username = self.username.strip()
        self.email = self.email.strip().lower()
        self.phone = self.phone.strip()
        self.governorate = self.governorate.strip()
        self.city = self.city.strip()
        self.address_line = self.address_line.strip()
        self.address_notes = self.address_notes.strip() if self.address_notes else None

        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")

        return self


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(min_length=2)
    email: str = Field(min_length=3)
    phone: str = Field(min_length=5)
    governorate: str = Field(min_length=2)
    city: str = Field(min_length=2)
    address_line: str = Field(min_length=5)
    address_notes: str | None = None

    @model_validator(mode="after")
    def normalize_payload(self):
        self.full_name = self.full_name.strip()
        self.email = self.email.strip().lower()
        self.phone = self.phone.strip()
        self.governorate = self.governorate.strip()
        self.city = self.city.strip()
        self.address_line = self.address_line.strip()
        self.address_notes = self.address_notes.strip() if self.address_notes else None
        return self


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
