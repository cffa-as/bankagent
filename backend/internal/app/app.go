package app

import (
	"database/sql"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/cffa-as/bankagent/internal/agent"
	"github.com/cffa-as/bankagent/internal/domain"
	"github.com/cffa-as/bankagent/internal/httpapi"
	"github.com/cffa-as/bankagent/internal/store"
)

type Config struct {
	Address   string
	Database  string
	AuthToken string
	Now       func() time.Time
}

func DefaultConfig() Config {
	return Config{
		Address:   ":8080",
		Database:  "bankagent.db",
		AuthToken: strings.TrimSpace(os.Getenv("BANKAGENT_AUTH_TOKEN")),
		Now:       time.Now,
	}
}

type Application struct {
	db      *sql.DB
	service *domain.Service
	handler http.Handler
}

func New(cfg Config) (*Application, error) {
	db, err := store.Open(cfg.Database)
	if err != nil {
		return nil, err
	}
	service := domain.NewService(store.NewRepository(db), cfg.Now)
	if baseURL, apiKey, model := os.Getenv("BANKAGENT_LLM_BASE_URL"), os.Getenv("BANKAGENT_LLM_API_KEY"), os.Getenv("BANKAGENT_LLM_MODEL"); baseURL != "" && apiKey != "" && model != "" {
		service.SetModelClient(agent.NewOpenAICompatibleClient(baseURL, apiKey, model))
	}
	if err := service.Seed(); err != nil {
		db.Close()
		return nil, err
	}
	authToken := strings.TrimSpace(cfg.AuthToken)
	if authToken == "" {
		authToken = "demo-user-1"
	}
	if authToken != "demo-user-1" && len(authToken) < 24 {
		db.Close()
		return nil, errors.New("BANKAGENT_AUTH_TOKEN must be at least 24 characters")
	}
	handler, err := httpapi.New(service, httpapi.AuthConfig{
		Token:  authToken,
		UserID: domain.DemoUserID,
	})
	if err != nil {
		db.Close()
		return nil, err
	}
	return &Application{db: db, service: service, handler: handler}, nil
}

func (a *Application) Handler() http.Handler { return a.handler }
func (a *Application) Close() error          { return a.db.Close() }
