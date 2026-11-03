package main

import (
	"log"
	"net/http"
	"time"

	"mailbag/internal/config"
	"mailbag/internal/db"
	"mailbag/internal/handlers"
	"mailbag/internal/mailer"
	"mailbag/internal/version"
)

func main() {
	cfg := config.Load()
	database, err := db.Open(cfg)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	db.PurgeExpiredTokens(database) // catch up on anything that expired while down
	go func() {
		for range time.NewTicker(time.Hour).C {
			db.PurgeExpiredTokens(database)
		}
	}()
	m := mailer.New(cfg)
	mux := http.NewServeMux()
	handlers.NewPublic(database, m, cfg).Routes(mux)
	handlers.NewAdmin(database, m, cfg.BaseURL, cfg.AdminAPIKey, cfg.AdminOrigins).Routes(mux)

	log.Printf("mailbag %s on :%s base=%s db=%s", version.String(), cfg.Port, cfg.BaseURL, dbMode(cfg))
	log.Fatal(http.ListenAndServe(":"+cfg.Port, mux))
}

func dbMode(cfg config.Config) string {
	if cfg.TursoURL != "" {
		return "turso"
	}
	return "sqlite"
}
