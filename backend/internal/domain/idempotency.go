package domain

import "context"

func (s *Service) Idempotency(ctx context.Context, userID, method, path, key, fingerprint string) ([]byte, int, error) {
	return s.repo.Idempotency(ctx, userID, method, path, key, fingerprint)
}

func (s *Service) SaveIdempotency(ctx context.Context, userID, method, path, key, fingerprint string, status int, response []byte) error {
	return s.repo.SaveIdempotency(ctx, userID, method, path, key, fingerprint, status, response, s.now())
}

func (s *Service) ReserveIdempotency(ctx context.Context, userID, method, path, key, fingerprint string) (bool, error) {
	return s.repo.ReserveIdempotency(ctx, userID, method, path, key, fingerprint, s.now())
}

func (s *Service) DeleteIdempotency(ctx context.Context, userID, method, path, key string) error {
	return s.repo.DeleteIdempotency(ctx, userID, method, path, key)
}
