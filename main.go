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
	database, err := db.Open(cfg.DataDir)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	m := mailer.New(cfg)
	mux := http.NewServeMux()
	handlers.NewPublic(database, m, cfg).Routes(mux)
	handlers.NewAdmin(database, cfg.AdminAPIKey).Routes(mux)

	log.Printf("mailcollector on :%s base=%s", cfg.Port, cfg.BaseURL)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, mux))
}
