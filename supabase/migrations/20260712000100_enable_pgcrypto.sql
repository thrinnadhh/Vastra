-- Provide cryptographic helpers and secure UUID generation for later schemas.
create schema if not exists extensions;

create extension if not exists pgcrypto
with schema extensions;
