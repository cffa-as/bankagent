package app

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/cffa-as/bankagent/internal/domain"
	"github.com/cffa-as/bankagent/internal/httpapi"
	"github.com/cffa-as/bankagent/internal/store"
)

type Config struct {
	Address  string
	Database string
	Now      func() time.Time
}

func DefaultConfig() Config {
	return Config{Address: ":8080", Database: "bankagent.db", Now: time.Now}
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
	if err := service.Seed(); err != nil {
		db.Close()
		return nil, err
	}
	return &Application{db: db, service: service, handler: httpapi.New(service)}, nil
}

func (a *Application) Handler() http.Handler { return a.handler }
func (a *Application) Close() error          { return a.db.Close() }
