-- Initialize database for development
-- This script runs when the PostgreSQL container starts for the first time

-- Create additional databases if needed
CREATE DATABASE react_calendar_test;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE react_calendar_dev TO postgres;
GRANT ALL PRIVILEGES ON DATABASE react_calendar_test TO postgres;