package config

import "os"

type Config struct {
	Port        string
	DataDir     string
	AdminAPIKey string
	BaseURL     string

	TursoURL   string
	TursoToken string

	SMTPHost string
	SMTPPort string
	SMTPUser string
	SMTPPass string
	SMTPFrom string

	PlunkAPIKey string
}

func Load() Config {
	return Config{
		Port:        env("PORT", "8080"),
		DataDir:     env("DATA_DIR", "./data"),
		AdminAPIKey: env("ADMIN_API_KEY", "change-me"),
		BaseURL:     env("BASE_URL", "http://localhost:8080"),
		SMTPHost:    os.Getenv("SMTP_HOST"),
		SMTPPort:    env("SMTP_PORT", "587"),
		SMTPUser:    os.Getenv("SMTP_USER"),
		SMTPPass:    os.Getenv("SMTP_PASS"),
		SMTPFrom:    env("SMTP_FROM", "hello@yourdomain.com"),
		PlunkAPIKey: os.Getenv("PLUNK_API_KEY"),
		TursoURL:    os.Getenv("TURSO_DATABASE_URL"),
		TursoToken:  os.Getenv("TURSO_AUTH_TOKEN"),
	}
}

func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
