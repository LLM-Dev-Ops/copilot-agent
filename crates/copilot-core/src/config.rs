use config::{Config, ConfigError, Environment, File};
use secrecy::{ExposeSecret, Secret};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub auth: AuthConfig,
    pub llm: LlmConfig,
    pub server: ServerConfig,
}

impl AppConfig {
    pub fn load() -> Result<Self, ConfigError> {
        Self::load_from_env("APP")
    }

    pub fn load_from_env(prefix: &str) -> Result<Self, ConfigError> {
        let builder = Config::builder()
            .add_source(
                Environment::with_prefix(prefix)
                    .separator("__")
                    .try_parsing(true),
            )
            .set_default("database.max_connections", 10)?
            .set_default("database.min_connections", 2)?
            .set_default("redis.max_connections", 10)?
            .set_default("auth.token_expiry_seconds", 3600)?
            .set_default("auth.issuer", "llm-copilot-agent")?
            .set_default("auth.audience", "copilot-api")?
            .set_default("llm.max_tokens", 4096)?
            .set_default("llm.temperature", 0.7)?
            .set_default("server.host", "0.0.0.0")?
            .set_default("server.port", 8080)?
            .set_default("server.workers", 4)?;

        let config = builder.build()?;
        config.try_deserialize()
    }

    pub fn load_from_file(path: &str) -> Result<Self, ConfigError> {
        let builder = Config::builder()
            .add_source(File::with_name(path))
            .add_source(Environment::with_prefix("APP").separator("__"));

        let config = builder.build()?;
        config.try_deserialize()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub url: Secret<String>,
    #[serde(default = "default_max_connections")]
    pub max_connections: u32,
    #[serde(default = "default_min_connections")]
    pub min_connections: u32,
}

impl DatabaseConfig {
    pub fn new(url: String) -> Self {
        Self {
            url: Secret::new(url),
            max_connections: default_max_connections(),
            min_connections: default_min_connections(),
        }
    }

    pub fn with_pool_size(mut self, min: u32, max: u32) -> Self {
        self.min_connections = min;
        self.max_connections = max;
        self
    }

    pub fn url(&self) -> &str {
        self.url.expose_secret()
    }
}

fn default_max_connections() -> u32 {
    10
}

fn default_min_connections() -> u32 {
    2
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisConfig {
    pub url: Secret<String>,
    #[serde(default = "default_redis_max_connections")]
    pub max_connections: u32,
}

impl RedisConfig {
    pub fn new(url: String) -> Self {
        Self {
            url: Secret::new(url),
            max_connections: default_redis_max_connections(),
        }
    }

    pub fn with_max_connections(mut self, max: u32) -> Self {
        self.max_connections = max;
        self
    }

    pub fn url(&self) -> &str {
        self.url.expose_secret()
    }
}

fn default_redis_max_connections() -> u32 {
    10
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub jwt_secret: Secret<String>,
    #[serde(default = "default_token_expiry_seconds")]
    pub token_expiry_seconds: u64,
    #[serde(default = "default_issuer")]
    pub issuer: String,
    #[serde(default = "default_audience")]
    pub audience: String,
}

impl AuthConfig {
    pub fn new(jwt_secret: String) -> Self {
        Self {
            jwt_secret: Secret::new(jwt_secret),
            token_expiry_seconds: default_token_expiry_seconds(),
            issuer: default_issuer(),
            audience: default_audience(),
        }
    }

    pub fn with_expiry(mut self, seconds: u64) -> Self {
        self.token_expiry_seconds = seconds;
        self
    }

    pub fn with_issuer(mut self, issuer: String) -> Self {
        self.issuer = issuer;
        self
    }

    pub fn with_audience(mut self, audience: String) -> Self {
        self.audience = audience;
        self
    }

    pub fn jwt_secret(&self) -> &str {
        self.jwt_secret.expose_secret()
    }

    pub fn token_expiry(&self) -> Duration {
        Duration::from_secs(self.token_expiry_seconds)
    }
}

fn default_token_expiry_seconds() -> u64 {
    3600 // 1 hour
}

fn default_issuer() -> String {
    "llm-copilot-agent".to_string()
}

fn default_audience() -> String {
    "copilot-api".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    pub provider: String,
    pub model: String,
    pub api_key: Secret<String>,
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    #[serde(default = "default_temperature")]
    pub temperature: f32,
}

impl LlmConfig {
    pub fn new(provider: String, model: String, api_key: String) -> Self {
        Self {
            provider,
            model,
            api_key: Secret::new(api_key),
            max_tokens: default_max_tokens(),
            temperature: default_temperature(),
        }
    }

    pub fn with_max_tokens(mut self, max_tokens: u32) -> Self {
        self.max_tokens = max_tokens;
        self
    }

    pub fn with_temperature(mut self, temperature: f32) -> Self {
        self.temperature = temperature;
        self
    }

    pub fn api_key(&self) -> &str {
        self.api_key.expose_secret()
    }
}

fn default_max_tokens() -> u32 {
    4096
}

fn default_temperature() -> f32 {
    0.7
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_workers")]
    pub workers: usize,
}

impl ServerConfig {
    pub fn new() -> Self {
        Self {
            host: default_host(),
            port: default_port(),
            workers: default_workers(),
        }
    }

    pub fn with_host(mut self, host: String) -> Self {
        self.host = host;
        self
    }

    pub fn with_port(mut self, port: u16) -> Self {
        self.port = port;
        self
    }

    pub fn with_workers(mut self, workers: usize) -> Self {
        self.workers = workers;
        self
    }

    pub fn address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self::new()
    }
}

fn default_host() -> String {
    "0.0.0.0".to_string()
}

fn default_port() -> u16 {
    8080
}

fn default_workers() -> usize {
    4
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_config_creation() {
        let config = DatabaseConfig::new("postgres://localhost".to_string())
            .with_pool_size(5, 20);

        assert_eq!(config.url(), "postgres://localhost");
        assert_eq!(config.min_connections, 5);
        assert_eq!(config.max_connections, 20);
    }

    #[test]
    fn test_redis_config_creation() {
        let config = RedisConfig::new("redis://localhost".to_string())
            .with_max_connections(15);

        assert_eq!(config.url(), "redis://localhost");
        assert_eq!(config.max_connections, 15);
    }

    #[test]
    fn test_auth_config_creation() {
        let config = AuthConfig::new("secret123".to_string())
            .with_expiry(7200)
            .with_issuer("test-issuer".to_string())
            .with_audience("test-audience".to_string());

        assert_eq!(config.jwt_secret(), "secret123");
        assert_eq!(config.token_expiry_seconds, 7200);
        assert_eq!(config.issuer, "test-issuer");
        assert_eq!(config.audience, "test-audience");
    }

    #[test]
    fn test_llm_config_creation() {
        let config = LlmConfig::new(
            "openai".to_string(),
            "gpt-4".to_string(),
            "sk-test".to_string(),
        )
        .with_max_tokens(2048)
        .with_temperature(0.5);

        assert_eq!(config.provider, "openai");
        assert_eq!(config.model, "gpt-4");
        assert_eq!(config.api_key(), "sk-test");
        assert_eq!(config.max_tokens, 2048);
        assert_eq!(config.temperature, 0.5);
    }

    #[test]
    fn test_server_config_creation() {
        let config = ServerConfig::new()
            .with_host("127.0.0.1".to_string())
            .with_port(3000)
            .with_workers(8);

        assert_eq!(config.host, "127.0.0.1");
        assert_eq!(config.port, 3000);
        assert_eq!(config.workers, 8);
        assert_eq!(config.address(), "127.0.0.1:3000");
    }

    #[test]
    fn test_server_config_defaults() {
        let config = ServerConfig::default();

        assert_eq!(config.host, "0.0.0.0");
        assert_eq!(config.port, 8080);
        assert_eq!(config.workers, 4);
    }
}
