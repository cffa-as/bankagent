package main

import (
	"log"
	"net/http"
	"os"

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
	if err := http.ListenAndServe(cfg.Address, application.Handler()); err != nil {
		log.Fatal(err)
	}
}
