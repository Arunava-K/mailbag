package main

import (
	"log"
	"net/http"

	"mailcollector/internal/config"
	"mailcollector/internal/db"
	"mailcollector/internal/handlers"
	"mailcollector/internal/mailer"
)

func main() {
	cfg := config.Load()
	database, err := db.Open(cfg)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	m := mailer.New(cfg)
	mux := http.NewServeMux()
	handlers.NewPublic(database, m, cfg).Routes(mux)
	handlers.NewAdmin(database, cfg.AdminAPIKey, cfg.AdminOrigins).Routes(mux)

	log.Printf("mailcollector on :%s base=%s db=%s", cfg.Port, cfg.BaseURL, dbMode(cfg))
	log.Fatal(http.ListenAndServe(":"+cfg.Port, mux))
}

func dbMode(cfg config.Config) string {
	if cfg.TursoURL != "" {
		return "turso"
	}
	return "sqlite"
}
