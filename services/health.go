package services

type HealthService struct {
	env string
}

type HealthStatus struct {
	Env    string `json:"env"`
	Status string `json:"status"`
}

func NewHealthService(env string) *HealthService {
	return &HealthService{env: env}
}

func (s *HealthService) Status() HealthStatus {
	return HealthStatus{
		Env:    s.env,
		Status: "ok",
	}
}
