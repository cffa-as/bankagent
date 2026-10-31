package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/cffa-as/bankagent/internal/app"
)

func main() {
	cfg := app.DefaultConfig()
	if value := os.Getenv("BANKAGENT_ADDR"); value != "" {
		cfg.Address = value
	}
	if value := os.Getenv("BANKAGENT_DATABASE"); value != "" {
		cfg.Database = value
	}

	application, err := app.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer application.Close()

	log.Printf("bankagent listening on %s", cfg.Address)
	server := &http.Server{
		Addr:              cfg.Address,
		Handler:           application.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
